import { Redirect } from 'expo-router';
import { useSimpleData } from '../providers/SimpleDataProvider';

/** Initial route: send to the tabs when logged in, otherwise to login. */
export default function Index() {
  const { currentUser } = useSimpleData();
  return <Redirect href={currentUser ? '/(tabs)/home' : '/login'} />;
}
