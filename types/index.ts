export type UserRole = 'buyer' | 'individual_seller' | 'vendor';
export type ConditionType = 'first_hand' | 'second_hand';
export type TransactionType = 'buy' | 'sell' | 'swap' | 'rent';

export interface NeighborhoodLocation { latitude: number; longitude: number; localityName: string }
export interface AppUser { id: string; username: string; email: string; role: UserRole; vendorVerified: boolean; location?: NeighborhoodLocation; radiusPreference: number }
export interface ListingDraft { title: string; description: string; category: string; conditionType: ConditionType; transactionTypes: TransactionType[]; price: number; rentalDetails?: { pricePerDay: number; securityDeposit: number }; images: string[]; location: NeighborhoodLocation }
export interface Listing extends ListingDraft { id: string; ownerId: string; ownerName: string; ownerRole?: UserRole; vendorVerified?: boolean; status: 'active' | 'sold' | 'rented' | 'inactive'; distanceKm?: number; createdAt: string }
export interface RequestedBundleItem { title: string; category?: string }
export interface BundleMatch { seller: Pick<AppUser, 'id' | 'username' | 'role' | 'vendorVerified'>; overlap: number; requestedCount: number; matchPercent: number; distanceKm: number; matchedItems: { requestedItem: RequestedBundleItem; listing: Listing; score: number }[] }
export interface SalesTransaction { id: string; listingId: Listing | { _id: string; title: string; images: string[]; status: Listing['status'] }; buyerId: { username: string }; sellerId: string; type: 'sale' | 'rental'; amount: number; status: 'completed' | 'pending_pickup'; createdAt: string }
export interface SalesSummary { earnings: number; pendingPickup: number; transactions: SalesTransaction[] }
export interface ChatParticipant { id: string; username: string; role: UserRole; vendorVerified: boolean }
export interface ChatThread { id: string; listing: { id: string; title: string; images: string[]; ownerId: string }; participants: ChatParticipant[]; lastMessage: string; updatedAt: string }
export interface ChatMessage { id: string; chatId: string; senderId: string | { id: string; username: string }; text: string; kind: 'text' | 'offer'; offer?: { type: 'cash' | 'trade'; amount?: number; itemDescription?: string }; createdAt: string }
