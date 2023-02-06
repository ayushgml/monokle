import {useCallback, useMemo, useState} from 'react';
import {useDebounce} from 'react-use';

import {Select} from 'antd';

import {isEmpty, isEqual, omit} from 'lodash';

import {DEFAULT_EDITOR_DEBOUNCE, PANE_CONSTRAINT_VALUES} from '@constants/constants';

import {useAppDispatch, useAppSelector} from '@redux/hooks';
import {updateResourceFilter} from '@redux/reducers/main';
import {openFiltersPresetModal} from '@redux/reducers/ui';
import {isInClusterModeSelector, isInPreviewModeSelectorNew} from '@redux/selectors';
import {
  allResourceAnnotationsSelector,
  allResourceKindsSelector,
  allResourceLabelsSelector,
} from '@redux/selectors/resourceMapSelectors';
import {startClusterConnection} from '@redux/thunks/cluster';

import {useNamespaces} from '@hooks/useNamespaces';

import {useWindowSize} from '@utils/hooks';

import {Filter, FilterField, FilterHeader, KeyValueInput, NewKeyValueInput} from '@monokle/components';
import {ROOT_FILE_ENTRY} from '@shared/constants/fileEntry';
import {ResourceFilterType} from '@shared/models/appState';
import {kubeConfigContextSelector} from '@shared/utils/selectors';

import * as S from './ResourceFilter.styled';

export const NAVIGATOR_FILTER_BODY_HEIGHT = 375;

export type Props = {
  active: boolean;
  onToggle: () => void;
};

const ResourceFilter = ({active, onToggle}: Props) => {
  const dispatch = useAppDispatch();
  const {width: windowWidth} = useWindowSize();

  const [allNamespaces] = useNamespaces({extra: []});
  const isPaneWideEnough = useAppSelector(
    state => windowWidth * state.ui.paneConfiguration.navPane > PANE_CONSTRAINT_VALUES.navPane
  );
  const areFiltersDisabled = useAppSelector(state => Boolean(state.main.checkedResourceIdentifiers.length));
  const fileMap = useAppSelector(state => state.main.fileMap);
  const filtersMap = useAppSelector(state => state.main.resourceFilter);
  const isInPreviewMode = useAppSelector(isInPreviewModeSelectorNew);
  const isInClusterMode = useAppSelector(isInClusterModeSelector);

  const kubeConfigContext = useAppSelector(kubeConfigContextSelector);
  const resourceFilterKinds = useAppSelector(state => state.main.resourceFilter.kinds ?? []);

  const allResourceKinds = useAppSelector(allResourceKindsSelector);
  const allResourceLabels = useAppSelector(allResourceLabelsSelector);
  const allResourceAnnotations = useAppSelector(allResourceAnnotationsSelector);

  const [localResourceFilter, setLocalResourceFilter] = useState<ResourceFilterType>(filtersMap);

  const autocompleteOptions = useMemo(() => {
    return {
      namespaces: allNamespaces?.map(n => ({value: n})) ?? [],
      kinds: allResourceKinds?.map(n => ({value: n})) ?? [],
      labels: Object.keys(allResourceLabels)?.map(n => ({value: n})) ?? [],
      annotations: Object.keys(allResourceAnnotations)?.map(n => ({value: n})) ?? [],
      files: Object.keys(fileMap).map(option => ({value: option})) ?? [],
    };
  }, [allNamespaces, allResourceKinds, allResourceLabels, allResourceAnnotations, fileMap]);

  const isSavePresetDisabled = useMemo(() => {
    return (
      isEmpty(localResourceFilter?.name) &&
      isEmpty(localResourceFilter?.kinds) &&
      isEmpty(localResourceFilter?.namespaces) &&
      isEmpty(localResourceFilter?.labels) &&
      isEmpty(localResourceFilter?.annotations) &&
      (!localResourceFilter?.fileOrFolderContainedIn ||
        localResourceFilter?.fileOrFolderContainedIn === ROOT_FILE_ENTRY)
    );
  }, [localResourceFilter]);

  const hasActiveFilters = useMemo(
    () =>
      Object.entries(localResourceFilter)
        .map(([key, value]) => {
          return {filterName: key, filterValue: value};
        })
        .filter(filter => filter.filterValue && Object.values(filter.filterValue).length).length > 0,
    [localResourceFilter]
  );

  const handleChange = useCallback((delta: Partial<any>) => {
    setLocalResourceFilter(prevState => ({...prevState, ...delta}));
  }, []);

  const handleSearched = useCallback(
    (newSearch: string) => {
      handleChange({
        name: newSearch,
      });
    },
    [handleChange]
  );

  const handleClear = useCallback(() => {
    handleChange({
      name: null,
      kinds: null,
      namespaces: null,
      labels: {},
      annotations: {},
      fileOrFolderContainedIn: null,
    });
  }, [handleChange]);

  const onKindChangeHandler = useCallback(
    (selectedKinds: string[]) => {
      handleChange({kinds: selectedKinds});
    },
    [handleChange]
  );

  const onKindClearHandler = useCallback(() => {
    handleChange({kinds: null});
  }, [handleChange]);

  const onNamespaceChangeHandler = useCallback(
    (namespaces: string[]) => {
      handleChange({namespaces});
    },
    [handleChange]
  );

  const onNamespaceClearHandler = useCallback(() => {
    handleChange({namespaces: null});
  }, [handleChange]);

  const handleUpsertLabelFilter = useCallback(
    ([key, value]: any) => {
      handleChange({
        labels: {...localResourceFilter.labels, [key]: value},
      });
    },
    [handleChange, localResourceFilter.labels]
  );

  const handleRemoveLabelFilter = useCallback(
    (key: string) => {
      handleChange({
        labels: omit(localResourceFilter.labels, key),
      });
    },
    [handleChange, localResourceFilter.labels]
  );

  const handleUpsertAnnotationFilter = useCallback(
    ([key, value]: any) => {
      handleChange({
        annotations: {...localResourceFilter.annotations, [key]: value},
      });
    },
    [handleChange, localResourceFilter.annotations]
  );

  const handleRemoveAnnotationFilter = useCallback(
    (key: string) => {
      handleChange({
        annotations: omit(localResourceFilter.annotations, key),
      });
    },
    [handleChange, localResourceFilter.annotations]
  );

  const onClearFileOrFolderContainedInHandler = useCallback(() => {
    handleChange({fileOrFolderContainedIn: null});
  }, [handleChange]);

  const updateFileOrFolderContainedIn = (selectedFileOrFolder: string) => {
    if (selectedFileOrFolder === ROOT_FILE_ENTRY) {
      handleChange({fileOrFolderContainedIn: undefined});
    } else {
      handleChange({fileOrFolderContainedIn: selectedFileOrFolder});
    }
  };

  const onClickLoadPreset = useCallback(() => {
    dispatch(openFiltersPresetModal('load'));
  }, [dispatch]);

  const onClickSavePreset = useCallback(() => {
    dispatch(openFiltersPresetModal('save'));
  }, [dispatch]);

  useDebounce(
    () => {
      if (isEqual(localResourceFilter, filtersMap)) {
        return;
      }

      dispatch(updateResourceFilter(localResourceFilter));

      if (isInClusterMode && !isEqual(resourceFilterKinds, localResourceFilter.kinds)) {
        dispatch(startClusterConnection({context: kubeConfigContext, isRestart: true}));
      }
    },
    DEFAULT_EDITOR_DEBOUNCE,
    [localResourceFilter]
  );

  return (
    <S.Container>
      <Filter
        height={NAVIGATOR_FILTER_BODY_HEIGHT}
        search={localResourceFilter?.name}
        onClear={handleClear}
        onSearch={handleSearched}
        active={active}
        hasActiveFilters={hasActiveFilters}
        onToggle={onToggle}
        header={
          <FilterHeader
            onClear={handleClear}
            filterActions={
              <>
                <S.FilterActionButton type="text" disabled={isSavePresetDisabled} onClick={onClickSavePreset}>
                  Save {isPaneWideEnough ? 'preset' : ''}
                </S.FilterActionButton>
                <S.FilterActionButton type="text" onClick={onClickLoadPreset}>
                  Load {isPaneWideEnough ? 'preset' : ''}
                </S.FilterActionButton>
              </>
            }
          />
        }
      >
        <FilterField name="Kind">
          <Select
            mode="tags"
            value={localResourceFilter.kinds || []}
            placeholder="Select one or more kinds.."
            options={autocompleteOptions.kinds}
            onChange={onKindChangeHandler}
            onClear={onKindClearHandler}
            style={{width: '100%'}}
          />
        </FilterField>

        <FilterField name="Namespace">
          <Select
            mode="tags"
            style={{width: '100%'}}
            placeholder="Select one or more namespaces.."
            value={localResourceFilter.namespaces}
            options={autocompleteOptions.namespaces}
            onChange={onNamespaceChangeHandler}
            onClear={onNamespaceClearHandler}
            allowClear
          />
        </FilterField>

        <FilterField name="Labels">
          <NewKeyValueInput onAddKeyValue={handleUpsertLabelFilter} keyOptions={autocompleteOptions.labels} />

          {Object.entries(localResourceFilter.labels).map(([key, value]) => {
            return (
              <KeyValueInput
                key={key}
                pair={[key, String(value || '')]}
                onDelete={handleRemoveLabelFilter}
                onChange={handleUpsertLabelFilter}
              />
            );
          })}
        </FilterField>

        <FilterField name="Annotations">
          <NewKeyValueInput onAddKeyValue={handleUpsertAnnotationFilter} keyOptions={autocompleteOptions.annotations} />

          {Object.entries(localResourceFilter.annotations).map(([key, value]) => {
            return (
              <KeyValueInput
                key={key}
                pair={[key, String(value || '')]}
                onDelete={handleRemoveAnnotationFilter}
                onChange={handleUpsertAnnotationFilter}
              />
            );
          })}
        </FilterField>

        <FilterField name="Contained in file/folder:">
          <Select
            showSearch
            disabled={isInPreviewMode || areFiltersDisabled}
            value={localResourceFilter.fileOrFolderContainedIn}
            defaultValue={ROOT_FILE_ENTRY}
            onChange={updateFileOrFolderContainedIn}
            options={autocompleteOptions.files}
            onClear={onClearFileOrFolderContainedInHandler}
            allowClear
          />
        </FilterField>
      </Filter>
    </S.Container>
  );
};

export default ResourceFilter;
