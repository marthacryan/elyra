/*
 * Copyright 2018-2020 Elyra Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PipelineEditorWidget } from '@elyra/pipeline-editor';
import {
  pipelineIcon,
  RequestErrors,
  showFormDialog
} from '@elyra/ui-components';

import { JupyterFrontEnd } from '@jupyterlab/application';
import { Dialog } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget
} from '@jupyterlab/docregistry';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { ServiceManager } from '@jupyterlab/services';

import { CommandRegistry } from '@lumino/commands';
import { Signal } from '@lumino/signaling';
import React from 'react';

import { formDialogWidget } from './formDialogWidget';
import { PipelineExportDialog } from './PipelineExportDialog';
import { PipelineService } from './PipelineService';
import { PipelineSubmissionDialog } from './PipelineSubmissionDialog';

const PIPELINE_CLASS = 'elyra-PipelineEditor';

export const commandIDs = {
  openPipelineEditor: 'pipeline-editor:open',
  openMetadata: 'elyra-metadata:open',
  openDocManager: 'docmanager:open',
  newDocManager: 'docmanager:new-untitled',
  submitNotebook: 'notebook:submit',
  addFileToPipeline: 'pipeline-editor:add-node'
};
export class PipelineEditorFactory extends ABCWidgetFactory<DocumentWidget> {
  shell: JupyterFrontEnd.IShell;
  commands: CommandRegistry;
  browserFactory: IFileBrowserFactory;
  serviceManager: ServiceManager;
  addFileToPipelineSignal: Signal<this, any>;

  constructor(options: any) {
    super(options);
    this.shell = options.shell;
    this.commands = options.commands;
    this.browserFactory = options.browserFactory;
    this.serviceManager = options.serviceManager;
    this.addFileToPipelineSignal = new Signal<this, any>(this);
  }

  async handleRunPipeline(
    pipeline_path: string,
    pipelineFlow: any
  ): Promise<void> {
    const pipelineName = PathExt.basename(
      pipeline_path,
      PathExt.extname(pipeline_path)
    );

    const runtimes = await PipelineService.getRuntimes(false).catch(error =>
      RequestErrors.serverError(error)
    );
    const local_runtime: any = {
      name: 'local',
      display_name: 'Run in-place locally'
    };
    runtimes.unshift(JSON.parse(JSON.stringify(local_runtime)));

    const dialogOptions: Partial<Dialog.IOptions<any>> = {
      title: 'Run pipeline',
      body: formDialogWidget(
        <PipelineSubmissionDialog name={pipelineName} runtimes={runtimes} />
      ),
      buttons: [Dialog.cancelButton(), Dialog.okButton()],
      defaultButton: 1,
      focusNodeSelector: '#pipeline_name'
    };
    const dialogResult = await showFormDialog(dialogOptions);

    if (dialogResult.value == null) {
      // When Cancel is clicked on the dialog, just return
      return;
    }

    const runtime_config = dialogResult.value.runtime_config;
    const runtime =
      PipelineService.getRuntimeName(runtime_config, runtimes) || 'local';

    PipelineService.setNodePathsRelativeToWorkspace(
      pipelineFlow.pipelines[0],
      pipeline_path
    );

    pipelineFlow.pipelines[0]['app_data']['name'] =
      dialogResult.value.pipeline_name;
    pipelineFlow.pipelines[0]['app_data']['runtime'] = runtime;
    pipelineFlow.pipelines[0]['app_data']['runtime-config'] = runtime_config;

    PipelineService.submitPipeline(
      pipelineFlow,
      PipelineService.getDisplayName(
        dialogResult.value.runtime_config,
        runtimes
      )
    ).catch(error => RequestErrors.serverError(error));
  }

  async handleExportPipeline(
    pipeline_path: string,
    pipelineFlow: any
  ): Promise<string | undefined> {
    const runtimes = await PipelineService.getRuntimes().catch(error =>
      RequestErrors.serverError(error)
    );

    const dialogOptions: Partial<Dialog.IOptions<any>> = {
      title: 'Export pipeline',
      body: formDialogWidget(<PipelineExportDialog runtimes={runtimes} />),
      buttons: [Dialog.cancelButton(), Dialog.okButton()],
      defaultButton: 1,
      focusNodeSelector: '#runtime_config'
    };
    const dialogResult = await showFormDialog(dialogOptions);

    if (dialogResult.value == null) {
      // When Cancel is clicked on the dialog, just return
      return;
    }

    const pipeline_dir = PathExt.dirname(pipeline_path);
    const pipeline_name = PathExt.basename(
      pipeline_path,
      PathExt.extname(pipeline_path)
    );
    const pipeline_export_format = dialogResult.value.pipeline_filetype;

    let pipeline_export_path = pipeline_name + '.' + pipeline_export_format;
    // only prefix the '/' when pipeline_dir is non-empty
    if (pipeline_dir) {
      pipeline_export_path = pipeline_dir + '/' + pipeline_export_path;
    }

    const overwrite = dialogResult.value.overwrite;

    const runtime_config = dialogResult.value.runtime_config;
    const runtime = PipelineService.getRuntimeName(runtime_config, runtimes);

    PipelineService.setNodePathsRelativeToWorkspace(
      pipelineFlow.pipelines[0],
      pipeline_path
    );

    pipelineFlow.pipelines[0]['app_data']['name'] = pipeline_name;
    pipelineFlow.pipelines[0]['app_data']['runtime'] = runtime;
    pipelineFlow.pipelines[0]['app_data']['runtime-config'] = runtime_config;

    PipelineService.exportPipeline(
      pipelineFlow,
      pipeline_export_format,
      pipeline_export_path,
      overwrite
    ).catch(error => RequestErrors.serverError(error));
  }

  protected createNewWidget(context: DocumentRegistry.Context): DocumentWidget {
    // Creates a blank widget with a DocumentWidget wrapper
    const props = {
      shell: this.shell,
      commands: this.commands,
      browserFactory: this.browserFactory,
      context: context,
      addFileToPipelineSignal: this.addFileToPipelineSignal,
      serviceManager: this.serviceManager,
      handleExportPipeline: this.handleExportPipeline,
      handleRunPipeline: this.handleRunPipeline
    };
    const content = new PipelineEditorWidget(props);
    const widget = new DocumentWidget({
      content,
      context,
      node: document.createElement('div')
    });
    widget.addClass(PIPELINE_CLASS);
    widget.title.icon = pipelineIcon;
    return widget;
  }
}
