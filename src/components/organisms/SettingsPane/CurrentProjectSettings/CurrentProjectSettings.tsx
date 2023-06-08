import {useCallback} from 'react';

import {
  activeProjectSelector,
  changeCurrentProjectName,
  currentConfigSelector,
  updateProjectConfig,
} from '@redux/appConfig';
import {useAppDispatch, useAppSelector} from '@redux/hooks';

import {Project, ProjectConfig} from '@shared/models/config';

import {Settings} from '../Settings/Settings';

export const CurrentProjectSettings = () => {
  const dispatch = useAppDispatch();
  const mergedConfig: ProjectConfig = useAppSelector(currentConfigSelector);
  const activeProject: Project | undefined = useAppSelector(activeProjectSelector);

  const changeProjectConfig = useCallback(
    (config: ProjectConfig) => {
      dispatch(updateProjectConfig({config, fromConfigFile: false}));
    },
    [dispatch]
  );

  const onProjectNameChange = (projectName: string) => {
    if (projectName) {
      dispatch(changeCurrentProjectName(projectName));
    }
  };

  return (
    <Settings
      config={mergedConfig}
      onConfigChange={changeProjectConfig}
      showProjectName
      projectName={activeProject?.name}
      onProjectNameChange={onProjectNameChange}
    />
  );
};
