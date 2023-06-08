import log from 'loglevel';
import * as monaco from 'monaco-editor';
import {v4 as uuidv4} from 'uuid';

import {trackEvent} from '@shared/utils/telemetry';

import {MONACO_EDITOR_INITIAL_CONFIG} from './editor.constants';
import {EditorCommand, EditorHover, EditorLink} from './editor.types';
import {isPositionInRange, isRangeInRange} from './editor.utils';

let EDITOR: monaco.editor.IStandaloneCodeEditor | undefined;
let editorHovers: EditorHover[] = [];
let editorLinks: EditorLink[] = [];
let editorCommands: EditorCommand[] = [];
let editorDecorations: monaco.editor.IModelDeltaDecoration[] = [];
let editorDecorationsCollection: monaco.editor.IEditorDecorationsCollection | undefined;
let nextSelection: monaco.IRange | undefined;
let isRecreatingModel = false;
let editorType: 'local' | 'cluster' | undefined;
let hasTypedInEditor = false;
let hasModelContentChanged = false;

export const didEditorContentChange = () => hasModelContentChanged;

const modelContentChangeListeners: ((e: monaco.editor.IModelContentChangedEvent) => any)[] = [];

export const mountEditor = (props: {element: HTMLElement; type: 'local' | 'cluster'}) => {
  const {element, type} = props;
  if (EDITOR) {
    log.warn('Editor already mounted!');
    return;
  }
  editorType = type;
  EDITOR = monaco.editor.create(element, MONACO_EDITOR_INITIAL_CONFIG);
  EDITOR.onKeyDown(() => {
    if (hasTypedInEditor) {
      return;
    }
    trackEvent('edit/code_changes', {from: getEditorType()});
    hasTypedInEditor = true;
  });
  EDITOR.onDidChangeModelContent(e => {
    modelContentChangeListeners.forEach(listener => listener(e));
    hasModelContentChanged = true;
  });
  EDITOR.onDidChangeCursorPosition(() => {
    if (!isRecreatingModel) {
      consumeNextSelection();
    }
  });
};

export const getEditorType = () => editorType;

export const unmountEditor = () => {
  EDITOR?.dispose();
  EDITOR = undefined;
  hasTypedInEditor = false;
  hasModelContentChanged = false;
};

export const resetEditor = () => {
  clearEditorHovers();
  clearEditorLinks();
  clearEditorCommands();
  clearEditorDecorations();
  hasModelContentChanged = false;
};

const consumeNextSelection = () => {
  if (!nextSelection) {
    return;
  }
  const copy = structuredClone(nextSelection);
  nextSelection = undefined;
  return copy;
};

export const setEditorNextSelection = (range: monaco.IRange) => {
  nextSelection = range;
};

export function recreateEditorModel(editor: monaco.editor.ICodeEditor, text: string, language: string = 'yaml') {
  isRecreatingModel = true;
  resetEditor();
  editor.getModel()?.dispose();
  editor.setModel(monaco.editor.createModel(text, language));
  const selection = consumeNextSelection();
  if (selection) {
    setEditorSelection(selection);
  }
  isRecreatingModel = false;
}

export const getEditor = () => EDITOR;

export const addEditorHover = (hover: EditorHover) => {
  editorHovers.push(hover);
  return hover;
};

export const clearEditorHovers = () => {
  editorHovers = [];
};

export const addEditorLink = (link: EditorLink) => {
  editorLinks.push(link);
  return link;
};

export const clearEditorLinks = () => {
  editorLinks = [];
};

export const addEditorCommand = (payload: EditorCommand['payload'], supportHtml?: boolean) => {
  const {text, altText, handler, beforeText, afterText} = payload;

  const id = `cmd_${uuidv4()}`;
  const disposable: monaco.IDisposable = monaco.editor.registerCommand(id, handler);

  let markdownLink: monaco.IMarkdownString;

  if (supportHtml) {
    markdownLink = {
      isTrusted: true,
      supportHtml: true,
      value: `<a href="command:${id}">${text}</a>`,
    };
  } else {
    markdownLink = {
      isTrusted: true,
      value: `${beforeText || ''}[${text}](command:${id} '${altText}')${afterText || ''}`,
    };
  }

  const command: EditorCommand = {
    id,
    markdownLink,
    disposable,
    payload,
  };

  editorCommands.push(command);
  return command;
};

export const clearEditorCommands = () => {
  editorCommands.forEach(command => command.disposable.dispose());
  editorCommands = [];
};

export const addEditorDecorations = (decorations: monaco.editor.IModelDeltaDecoration[]) => {
  editorDecorations.push(...decorations);
  editorDecorationsCollection?.clear();
  editorDecorationsCollection = EDITOR?.createDecorationsCollection(editorDecorations);
};

export const setEditorSelection = (selectionRange: monaco.IRange) => {
  EDITOR?.setSelection(selectionRange);
  EDITOR?.revealLineInCenter(selectionRange.startLineNumber);
};

export const clearEditorDecorations = () => {
  editorDecorations = [];
  editorDecorationsCollection?.clear();
  editorDecorationsCollection = undefined;
};

monaco.languages.registerHoverProvider('yaml', {
  provideHover: (model, position) => {
    const positionHovers = editorHovers.filter(hover => isPositionInRange(position, hover.range));
    if (positionHovers.length === 0) {
      return null;
    }
    if (positionHovers.length === 1) {
      return positionHovers[0];
    }
    return {
      contents: positionHovers.map(hover => hover.contents).flat(),
    };
  },
});

monaco.languages.registerLinkProvider('yaml', {
  provideLinks: () => {
    return {
      links: editorLinks.map(link => ({
        range: link.range,
        tooltip: link.tooltip,
      })),
    };
  },
  resolveLink: async link => {
    const linksToResolve = editorLinks.filter(({range}) => isRangeInRange(range, link.range));
    const promises = linksToResolve.map(({handler}) => Promise.resolve(handler()));
    await Promise.all(promises);
    return {range: link.range};
  },
});

export const subscribeToEditorModelContentChanges = (listener: (e: monaco.editor.IModelContentChangedEvent) => any) => {
  modelContentChangeListeners.push(listener);
  EDITOR?.onDidChangeModelContent(listener);
};
