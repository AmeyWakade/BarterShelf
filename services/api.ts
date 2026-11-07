import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { AppUser, BundleMatch, ChatMessage, ChatThread, Listing, ListingDraft, NeighborhoodLocation, RequestedBundleItem, SalesSummary, UserRole } from '@/types';

function getApiUrl(): string {
  if (Constants.expoConfig?.extra?.apiUrl) return Constants.expoConfig.extra.apiUrl as string;
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp) return `http://${hostIp}:4000/api`;
  }
  return 'http://192.168.0.106:4000/api';
}
const API_URL = getApiUrl();
export function getPublicWebUrl(path: '/privacy-policy' | '/delete-account') {
  return `${API_URL.replace(/\/api\/?$/, '')}${path}`;
}
const SESSION_KEY = 'bartershelf.session.v1';
type Session = { token: string; user: AppUser };
let session: Session | null = null;
export class ApiError extends Error { constructor(message: string, public status = 0) { super(message); this.name = 'ApiError'; } }

export async function restoreSession(): Promise<Session | null> {
  const stored = await AsyncStorage.getItem(SESSION_KEY);
  session = stored ? JSON.parse(stored) as Session : null;
  if (session) {
    try { const result = await request<{ user: AppUser }>('/auth/me'); session.user = result.user; await persistSession(); }
    catch (error) { if (error instanceof ApiError && error.status === 401) await clearSession(); }
  }
  return session;
}
export function getSession() { return session; }
export async function persistSession() { if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export async function clearSession() { session = null; await AsyncStorage.removeItem(SESSION_KEY); }
export async function deleteAccount() {
  await request('/users/account', { method: 'DELETE' });
  await clearSession();
}
export async function blockUser(userId: string) {
  await request('/users/block', { method: 'POST', body: JSON.stringify({ userId }) });
}
export async function fetchBlockedUsers() {
  const result = await request<{ users: { id: string; username: string; role: UserRole; vendorVerified: boolean }[] }>('/users/blocked');
  return result.users;
}
export async function unblockUser(userId: string) {
  await request(`/users/block/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}
export type ReportReason = 'spam' | 'scam' | 'inappropriate_content' | 'offensive';
export async function submitReport(targetId: string, targetType: 'listing' | 'chat_message', reason: ReportReason) {
  return request<{ reportId: string; status: 'pending' }>('/reports', { method: 'POST', body: JSON.stringify({ targetId, targetType, reason }) });
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(authenticated && session ? { Authorization: `Bearer ${session.token}` } : {}), ...options.headers } });
  } catch { throw new ApiError(`Cannot reach BarterShelf API at ${API_URL}. Check the backend is running and set expo.extra.apiUrl to your computer's LAN IP for a physical phone.`); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error ?? `Request failed (${response.status}).`, response.status);
  return payload as T;
}
function setSession(value: Session) { session = value; return AsyncStorage.setItem(SESSION_KEY, JSON.stringify(value)); }

export async function signUp(input: { username: string; email: string; password: string; role: UserRole }): Promise<AppUser> {
  const result = await request<Session>('/auth/register', { method: 'POST', body: JSON.stringify(input) }, false); await setSession(result); return result.user;
}
export async function signIn(email: string, password: string): Promise<AppUser> {
  const result = await request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false); await setSession(result); return result.user;
}
export async function updateNeighborhood(location: NeighborhoodLocation) {
  if (!session) throw new ApiError('Sign in to save your neighborhood.');
  const result = await request<{ user: AppUser }>('/auth/me', { method: 'PATCH', body: JSON.stringify({ location }) }); session.user = result.user; await persistSession(); return result.user;
}
export async function updateRadiusPreference(radiusPreference: number) {
  if (!session) throw new ApiError('Sign in to save your radius preference.');
  await request('/listings/mine/preferences', { method: 'PATCH', body: JSON.stringify({ radiusPreference }) });
  session.user.radiusPreference = radiusPreference; await persistSession();
}

export async function fetchNearbyListings(location: NeighborhoodLocation, radius: number, filters: { condition?: string; transactionType?: string; q?: string }) {
  const query = new URLSearchParams({ lat: String(location.latitude), lng: String(location.longitude), radius: String(radius), ...Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]) });
  const result = await request<{ listings: Record<string, unknown>[] }>(`/listings/nearby?${query}`);
  return result.listings.map(normalizeListing);
}
export async function fetchMyListings() { const result = await request<{ listings: Record<string, unknown>[] }>('/listings/mine'); return result.listings.map(normalizeListing); }
export async function updateListingStatus(id: string,status: Listing['status']) { const result=await request<{listing:Record<string,unknown>}>(`/listings/${id}/status`,{method:'PATCH',body:JSON.stringify({status})});return normalizeListing(result.listing); }
export async function fetchListing(id: string) { const result = await request<{ listing: Record<string, unknown> }>(`/listings/${id}`); return normalizeListing(result.listing); }
export async function uploadImages(uris: string[]) {
  if (!uris.length) return [];
  const form = new FormData();
  for (const [index, uri] of uris.entries()) form.append('images', { uri, name: `listing-${Date.now()}-${index}.jpg`, type: 'image/jpeg' } as unknown as Blob);
  const result = await request<{ images: string[] }>('/uploads/images', { method: 'POST', body: form }); return result.images;
}
export async function publishListings(listings: ListingDraft[]) { const result = await request<{ listings: Record<string, unknown>[] }>('/listings', { method: 'POST', body: JSON.stringify(listings) }); return result.listings.map(normalizeListing); }
export async function fetchSalesSummary(): Promise<SalesSummary> {
  const result = await request<SalesSummary & { transactions: (SalesSummary['transactions'][number] & { _id?: string; id?: string })[] }>('/transactions/sales');
  return { ...result, transactions: result.transactions.map(item => ({ ...item, id: item.id ?? (item as SalesSummary['transactions'][number] & {_id?:string})._id ?? '' })) };
}
export async function approveTransaction(id:string){return request(`/transactions/${id}/approve`,{method:'PATCH',body:'{}'});}
export async function completeTransaction(id: string) { return request(`/transactions/${id}/complete`, { method: 'PATCH', body: '{}' }); }
export async function startTransaction(listingId: string, type: 'sale' | 'rental', days?: number) { return request('/transactions', { method: 'POST', body: JSON.stringify({ listingId, type, days }) }); }
export async function fetchChats(): Promise<ChatThread[]> {
  const result = await request<{ chats: Record<string, any>[] }>('/chats');
  return result.chats.map(chat => ({ id: String(chat._id ?? chat.id), listing: { id: String(chat.listingId?._id ?? ''), title: chat.listingId?.title ?? 'Listing', images: chat.listingId?.images ?? [], ownerId: String(chat.listingId?.ownerId ?? '') }, participants: (chat.participants ?? []).map((person: Record<string, any>) => ({ id: String(person._id), username: person.username, role: person.role, vendorVerified: person.vendorVerified })), lastMessage: chat.lastMessage ?? '', updatedAt: chat.updatedAt }));
}
export async function createChat(listingId: string): Promise<ChatThread> {
  const result = await request<{ chat: Record<string, any> }>('/chats', { method: 'POST', body: JSON.stringify({ listingId }) });
  const chat = result.chat; return { id: String(chat._id), listing: { id: String(chat.listingId?._id), title: chat.listingId?.title ?? 'Listing', images: chat.listingId?.images ?? [], ownerId: String(chat.listingId?.ownerId) }, participants: (chat.participants ?? []).map((person: Record<string, any>) => ({ id: String(person._id), username: person.username, role: person.role, vendorVerified: person.vendorVerified })), lastMessage: chat.lastMessage ?? '', updatedAt: chat.updatedAt };
}
export async function fetchChatMessages(chatId: string): Promise<ChatMessage[]> {
  const result = await request<{ messages: Record<string, any>[] }>(`/chats/${chatId}/messages`);
  return result.messages.map(message => ({ id: String(message._id), chatId: String(message.chatId), senderId: message.senderId?._id ? { id: String(message.senderId._id), username: message.senderId.username } : String(message.senderId), text: message.text, kind: message.kind, offer: message.offer, createdAt: message.createdAt }));
}
export async function postChatMessage(chatId: string, text: string, offer?: ChatMessage['offer']) {
  return request(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ text, kind: offer ? 'offer' : 'text', offer }) });
}
export async function findBundles(requestedItems: RequestedBundleItem[], location: NeighborhoodLocation, radius: number) {
  const result = await request<{ matches: (Omit<BundleMatch, 'matchedItems'> & { matchedItems: { requestedItem: RequestedBundleItem; listing: Record<string, unknown>; score: number }[] })[]; radiusKm: number; requestedCount: number }>('/bundle-match', { method: 'POST', body: JSON.stringify({ requestedItems, latitude: location.latitude, longitude: location.longitude, radius }) });
  return { ...result, matches: result.matches.map(match => ({ ...match, matchedItems: match.matchedItems.map(item => ({ ...item, listing: normalizeListing(item.listing) })) })) } as { matches: BundleMatch[]; radiusKm: number; requestedCount: number };
}
function normalizeListing(raw: Record<string, any>): Listing {
  const owner = raw.ownerId && typeof raw.ownerId === 'object' ? raw.ownerId : null;
  const location = raw.location?.coordinates ? { latitude: raw.location.coordinates[1], longitude: raw.location.coordinates[0], localityName: raw.localityName ?? '' } : raw.location;
  return { ...raw, id: String(raw._id ?? raw.id), ownerId: String(owner?._id ?? raw.ownerId), ownerName: owner?.username ?? raw.ownerName ?? 'Neighbor', ownerRole: owner?.role, vendorVerified: owner?.vendorVerified, location, createdAt: raw.createdAt ?? new Date().toISOString() } as Listing;
}
