import React from 'react';
import { useRouter } from 'expo-router';

import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { useSimpleData } from '../../providers/SimpleDataProvider';

export default function BookingsScreen(): React.JSX.Element {
  const { currentUser } = useSimpleData();
  const router = useRouter();

  const isCoach = currentUser?.role === 'coach';

  // De agenda is alleen nog de wegwijzer; de lessen zelf staan in het maandoverzicht,
  // waar ze ook betaald en geannuleerd worden.
  return (
    <Screen>
      {isCoach ? (
        <>
          <Button
            label="Nieuwe afspraak"
            variant="primary"
            onPress={() => router.push('/agenda/new')}
          />
          <Button
            label="Betalingen verwerken"
            variant="secondary"
            onPress={() => router.push('/admin/payments')}
          />
          <Button
            label="Beurtenkaarten"
            variant="secondary"
            onPress={() => router.push('/agenda/beurtenkaarten')}
          />
        </>
      ) : null}
      {/* Voor iedereen, want dit is sinds de verhuizing de enige plek waar een speler zijn
          eigen lessen nog terugvindt. */}
      <Button
        label="Maandoverzicht"
        variant={isCoach ? 'secondary' : 'primary'}
        onPress={() => router.push('/agenda/export')}
      />
    </Screen>
  );
}
