interface FileEntry {
  name: string,
  folder: string,
  highlight: boolean,
  selected: boolean,
  expanded: boolean,
  excluded: boolean,
  children?: FileEntry[],
  resourceIds?: string []
}

interface K8sResource {
  id: string,
  folder: string,
  file: string,
  name: string,
  kind: string,
  version: string,
  highlight: boolean,
  selected: boolean,
  content: any, // contains parsed yaml resource - used for filtering/etc
  refs?: ResourceRef[]
}

export enum ResourceRefType {
  KustomizationResource,
  KustomizationParent,
  ServicePodSelector,
  SelectedPodName,
  ConfigMapRef,
  ConfigMapConsumer
}

interface ResourceRef {
  targetResourceId: string,
  refType: ResourceRefType
}

interface NavigatorSubSection {
  name: string,
  kindSelector: string,
  apiVersionSelector: string
}

interface NavigatorSection {
  name: string,
  subsections: NavigatorSubSection[]
}

interface ObjectNavigator {
  name: string,
  sections: NavigatorSection[],
}

interface AppConfig {
  scanExcludes: string[],
  fileIncludes: string[],
  navigators: ObjectNavigator[],
  settings: {
    filterObjectsOnSelection: boolean
  }
}

type ResourceMapType = {
  [id: string]: K8sResource;
}

interface AppState {
  rootFolder: string,
  rootEntry: FileEntry,
  statusText: string,
  appConfig: AppConfig,
  resourceMap: ResourceMapType
}

export type {
  FileEntry, K8sResource, AppState, AppConfig, ResourceRef, ResourceMapType
};
