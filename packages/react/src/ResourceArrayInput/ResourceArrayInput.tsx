import { Group, Stack } from '@mantine/core';
import { InternalSchemaElement, getPathDisplayName, isPopulated } from '@medplum/core';
import { OperationOutcome } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react-hooks';
import { MouseEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ElementsContext } from '../ElementsInput/ElementsInput.utils';
import { ResourcePropertyInput } from '../ResourcePropertyInput/ResourcePropertyInput';
import { SliceInput } from '../SliceInput/SliceInput';
import { SupportedSliceDefinition } from '../SliceInput/SliceInput.utils';
import { ArrayAddButton } from '../buttons/ArrayAddButton';
import { ArrayRemoveButton } from '../buttons/ArrayRemoveButton';
import { killEvent } from '../utils/dom';
import classes from './ResourceArrayInput.module.css';
import { assignValuesIntoSlices, prepareSlices } from './ResourceArrayInput.utils';

export interface ResourceArrayInputProps {
  property: InternalSchemaElement;
  name: string;
  path: string;
  defaultValue?: any[];
  indent?: boolean;
  arrayElement?: boolean;
  outcome: OperationOutcome | undefined;
  onChange?: (value: any[]) => void;
  hideNonSliceValues?: boolean;
}

type SlicedValuesType = any[][];
export function ResourceArrayInput(props: Readonly<ResourceArrayInputProps>): JSX.Element {
  const { property, onChange } = props;
  const medplum = useMedplum();
  const [loading, setLoading] = useState(true);
  const [slices, setSlices] = useState<SupportedSliceDefinition[]>([]);
  // props.defaultValue should NOT be used after this; prefer the defaultValue state
  const [defaultValue] = useState<any[]>(() => (Array.isArray(props.defaultValue) ? props.defaultValue : []));
  const [slicedValues, setSlicedValues] = useState<SlicedValuesType>(() => [defaultValue]);
  const ctx = useContext(ElementsContext);

  // props.onChange should NOT be used directly; prefer onChangeWrapper
  const lastValue = useRef(defaultValue);
  useEffect(() => {
    const cleaned = slicedValues.flat().filter((val) => isPopulated(val));
    if (onChange) {
      if (lastValue.current.length !== cleaned.length || !lastValue.current.every((v, idx) => v === cleaned[idx])) {
        onChange(cleaned);
      }
    }
    lastValue.current = cleaned;
  }, [slicedValues, props.path, onChange]);

  const setSliceValue = useCallback(
    (newValues: any[], sliceIndex: number): void => {
      setSlicedValues((oldSlicedValues) => {
        const newSlicedValues = [...oldSlicedValues];
        newSlicedValues[sliceIndex] = newValues;
        return newSlicedValues;
      });
    },
    [setSlicedValues]
  );

  const propertyTypeCode = property.type[0]?.code;
  useEffect(() => {
    prepareSlices({
      medplum,
      property,
    })
      .then((slices) => {
        setSlices(slices);
        const slicedValues = assignValuesIntoSlices(defaultValue, slices, property.slicing, ctx.profileUrl);
        setSlicedValues(slicedValues);
        setLoading(false);
      })
      .catch((reason) => {
        console.error(reason);
        setLoading(false);
      });
  }, [medplum, property, defaultValue, ctx, setSlicedValues, props.path]);

  const sliceOnChanges = useMemo(() => {
    return slices.map((_slice, sliceIndex) => {
      return (newSliceValue: any[]) => {
        setSliceValue(newSliceValue, sliceIndex);
      };
    });
  }, [setSliceValue, slices]);

  if (loading) {
    return <div>Loading...</div>;
  }

  const nonSliceIndex = slices.length;
  const nonSliceValues = slicedValues[nonSliceIndex];

  // Hide non-sliced values when handling sliced extensions
  const showNonSliceValues = !(props.hideNonSliceValues ?? (propertyTypeCode === 'Extension' && slices.length > 0));
  const propertyDisplayName = getPathDisplayName(property.path);

  return (
    <Stack className={props.indent ? classes.indented : undefined}>
      {slices.map((slice, sliceIndex) => {
        return (
          <SliceInput
            slice={slice}
            key={slice.name}
            path={props.path}
            property={property}
            defaultValue={slicedValues[sliceIndex]}
            onChange={sliceOnChanges[sliceIndex]}
            testId={`slice-${slice.name}`}
          />
        );
      })}

      {showNonSliceValues &&
        nonSliceValues.map((value, valueIndex) => (
          <Group key={`${valueIndex}-${nonSliceValues.length}`} wrap="nowrap" style={{ flexGrow: 1 }}>
            <div style={{ flexGrow: 1 }}>
              <ResourcePropertyInput
                arrayElement={true}
                property={props.property}
                name={props.name + '.' + valueIndex}
                path={props.path}
                defaultValue={value}
                onChange={(newValue: any) => {
                  const newNonSliceValues = [...nonSliceValues];
                  newNonSliceValues[valueIndex] = newValue;
                  setSliceValue(newNonSliceValues, nonSliceIndex);
                }}
                defaultPropertyType={undefined}
                outcome={props.outcome}
              />
            </div>
            <ArrayRemoveButton
              propertyDisplayName={propertyDisplayName}
              testId={`nonsliced-remove-${valueIndex}`}
              onClick={(e: MouseEvent) => {
                killEvent(e);
                const newNonSliceValues = [...nonSliceValues];
                newNonSliceValues.splice(valueIndex, 1);
                setSliceValue(newNonSliceValues, nonSliceIndex);
              }}
            />
          </Group>
        ))}
      {showNonSliceValues && slicedValues.flat().length < property.max && (
        <Group wrap="nowrap" style={{ justifyContent: 'flex-start' }}>
          <ArrayAddButton
            propertyDisplayName={propertyDisplayName}
            onClick={(e: MouseEvent) => {
              killEvent(e);
              const newNonSliceValues = [...nonSliceValues];
              newNonSliceValues.push(undefined);
              setSliceValue(newNonSliceValues, nonSliceIndex);
            }}
            testId="nonsliced-add"
          />
        </Group>
      )}
    </Stack>
  );
}
