import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing } from '../constants/theme';
import { Patient } from '../data/mock';
import { Avatar, Badge, Button, Card, Chip, Divider, Input } from '../components/ui';

interface PatientsScreenProps {
  patients: Patient[];
  statusById: Record<string, 'waiting' | 'in-consult' | 'done'>;
  onStartConsult: (patientId: string) => void;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'queue', label: 'In Queue' },
  { id: 'done', label: 'Consulted' },
];

export const PatientsScreen: React.FC<PatientsScreenProps> = ({ patients, statusById, onStartConsult }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = patients.filter(p => {
    const matchesQuery =
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.village.toLowerCase().includes(query.toLowerCase());
    const status = statusById[p.id];
    const matchesFilter =
      filter === 'all' ||
      (filter === 'queue' && (!!status && status !== 'done')) ||
      (filter === 'done' && status === 'done');
    return matchesQuery && matchesFilter;
  });

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search patient or village..."
          leadingIcon="search"
        />
        <View style={styles.chipRow}>
          {FILTERS.map(f => (
            <Chip key={f.id} label={f.label} size="sm" selected={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(patient => (
          <Card key={patient.id} padding={12} radius={Radii.lg}>
            <View style={styles.row}>
              <Avatar uri={patient.avatar} name={patient.name} size={48} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{patient.name}</Text>
                  {statusById[patient.id] && (
                    <Badge
                      label={statusById[patient.id] === 'done' ? 'Consulted' : 'In Queue'}
                      tone={statusById[patient.id] === 'done' ? 'success' : 'primary'}
                    />
                  )}
                </View>
                <Text style={styles.meta}>
                  {patient.age}Y • {patient.gender} • {patient.bloodGroup}
                </Text>
                <Text style={styles.village}>{patient.village} • ABHA {patient.abhaId.slice(-4)}</Text>
                {!!patient.allergies.length && (
                  <View style={styles.allergyRow}>
                    {patient.allergies.map(a => (
                      <Badge key={a} label={a} tone="danger" />
                    ))}
                  </View>
                )}
              </View>
              <Button
                label="Consult"
                icon="medical-services"
                size="sm"
                onPress={() => onStartConsult(patient.id)}
              />
            </View>
            <Divider style={{ marginTop: 10 }} />
            <Text style={styles.recordMeta}>Last visit: Today • Records synced offline</Text>
          </Card>
        ))}
        {!filtered.length && (
          <Text style={styles.empty}>No patients found</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  topSection: {
    padding: Spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  list: {
    padding: Spacing.md,
    gap: 10,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
  },
  meta: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  village: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  allergyRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  recordMeta: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  empty: {
    textAlign: 'center',
    color: Colors.onSurfaceVariant,
    marginTop: 32,
    fontSize: 13,
  },
});
