import { Button, Group, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { normalizeErrorString, PatchOperation } from '@medplum/core';
import { Identifier, Patient } from '@medplum/fhirtypes';
import { Document, useMedplum } from '@medplum/react';
import { IconCircleCheck, IconCircleOff } from '@tabler/icons-react';
import { useState } from 'react';

interface PatientPrescriptionProps {
  patient: Patient;
  onPatientChange: (patient: Patient) => void;
}

export function PatientPrescription({ patient, onPatientChange }: PatientPrescriptionProps): JSX.Element {
  const medplum = useMedplum();

  const patientSynced = patient.identifier?.find((id) => id.system === 'https://neutron.health/patients');
  const [syncDisabled, setSyncDisabled] = useState<boolean>(!!patientSynced);

  async function testConnection(): Promise<void> {
    try {
      const result = await medplum.executeBot(
        {
          system: 'https://neutron.health/bots',
          value: 'test-auth',
        },
        {},
        'application/json'
      );

      console.log(result);
    } catch (err) {
      console.error(err);
    }
  }

  async function syncPatient(): Promise<void> {
    try {
      const photonPatientId = await medplum.executeBot(
        {
          system: 'https://neutron.health/bots',
          value: 'sync-patient',
        },
        {
          ...patient,
        },
        'application/fhir+json'
      );
      await updatePatient(patient, photonPatientId);
      notifications.show({
        icon: <IconCircleCheck />,
        title: 'Success',
        message: 'Patient synced',
      });
      setSyncDisabled(true);
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconCircleOff />,
        title: 'Error',
        message: normalizeErrorString(err),
      });
    }
  }

  async function updatePatient(patient: Patient, photonId: string): Promise<void> {
    const identifiers = patient.identifier ?? [];
    const photonIdentifier: Identifier = {
      system: 'https://neutron.health/patients',
      value: photonId,
    };
    identifiers.push(photonIdentifier);

    const patientId = patient.id as string;

    const op = patient.identifier ? 'replace' : 'add';
    const ops: PatchOperation[] = [
      { op: 'test', path: '/meta/versionId', value: patient.meta?.versionId },
      { op, path: '/identifier', value: identifiers },
    ];

    try {
      const updatedPatient = await medplum.patchResource('Patient', patientId, ops);
      onPatientChange(updatedPatient);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Document>
      <Group justify="space-between" mb="md">
        <Title order={3}>Prescription Management</Title>
        <Button onClick={testConnection}>Test Connection</Button>
        {syncDisabled ? null : <Button onClick={syncPatient}>Sync Patient to Photon Health</Button>}
      </Group>
      <photon-prescribe-workflow />
    </Document>
  );
}
