import { Redirect } from 'expo-router';import { getSession } from '@/services/api';export default function Index(){return <Redirect href={getSession()?'/(tabs)':'/auth'}/>}
