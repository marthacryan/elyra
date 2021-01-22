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

import { PathExt } from '@jupyterlab/coreutils';

import uuid4 from 'uuid/v4';

import { PIPELINE_CURRENT_VERSION } from './constants';
import pipeline_template from './pipeline-template.json';

/**
 * A utilities class for static functions.
 */
export class Utils {
  static getUUID(): any {
    return uuid4();
  }

  static getWorkspaceRelativeNodePath(
    pipelinePath: string,
    nodePath: string
  ): string {
    // since resolve returns an "absolute" path we need to strip off the leading '/'
    const workspacePath: string = PathExt.resolve(
      PathExt.dirname(pipelinePath),
      nodePath
    );
    return workspacePath;
  }

  static getPipelineRelativeNodePath(
    pipelinePath: string,
    nodePath: string
  ): string {
    const relativePath: string = PathExt.relative(
      PathExt.dirname(pipelinePath),
      nodePath
    );
    return relativePath;
  }

  /**
   * Verify if the given pipeline is "current" by looking on it's version, and perform
   * any conversion if needed.
   *
   * @param pipelineDefinition
   */
  static convertPipeline(pipelineDefinition: any, pipelinePath: string): any {
    let pipelineJSON = JSON.parse(JSON.stringify(pipelineDefinition));

    const currentVersion: number = Utils.getPipelineVersion(pipelineJSON);

    if (currentVersion < 1) {
      // original pipeline definition without a version
      console.info('Migrating pipeline to version 1.');
      pipelineJSON = this.convertPipelineV0toV1(pipelineJSON);
    }
    if (currentVersion < 2) {
      // adding relative path on the pipeline filenames
      console.info('Migrating pipeline to version 2.');
      pipelineJSON = this.convertPipelineV1toV2(pipelineJSON, pipelinePath);
    }
    if (currentVersion < 3) {
      // Adding python script support
      console.info('Migrating pipeline to version 3 (current version).');
      pipelineJSON = this.convertPipelineV2toV3(pipelineJSON, pipelinePath);
    }
    return pipelineJSON;
  }

  static setNodePathsRelativeToPipeline(
    pipeline: any,
    pipelinePath: string
  ): any {
    for (const node of pipeline.nodes) {
      node.app_data.filename = Utils.getPipelineRelativeNodePath(
        pipelinePath,
        node.app_data.filename
      );
    }
    return pipeline;
  }

  private static convertPipelineV0toV1(pipelineJSON: any): any {
    Utils.renamePipelineAppdataField(
      pipelineJSON.pipelines[0],
      'title',
      'name'
    );
    Utils.deletePipelineAppdataField(pipelineJSON.pipelines[0], 'export');
    Utils.deletePipelineAppdataField(
      pipelineJSON.pipelines[0],
      'export_format'
    );
    Utils.deletePipelineAppdataField(pipelineJSON.pipelines[0], 'export_path');

    // look into nodes
    for (const nodeKey in pipelineJSON.pipelines[0]['nodes']) {
      const node = pipelineJSON.pipelines[0]['nodes'][nodeKey];
      Utils.renamePipelineAppdataField(node, 'artifact', 'filename');
      Utils.renamePipelineAppdataField(node, 'image', 'runtime_image');
      Utils.renamePipelineAppdataField(node, 'vars', 'env_vars');
      Utils.renamePipelineAppdataField(
        node,
        'file_dependencies',
        'dependencies'
      );
      Utils.renamePipelineAppdataField(
        node,
        'recursive_dependencies',
        'include_subdirectories'
      );
    }

    pipelineJSON.pipelines[0]['app_data']['version'] = 1;
    return pipelineJSON;
  }

  private static convertPipelineV1toV2(
    pipelineJSON: any,
    pipelinePath: string
  ): any {
    pipelineJSON.pipelines[0] = this.setNodePathsRelativeToPipeline(
      pipelineJSON.pipelines[0],
      pipelinePath
    );
    pipelineJSON.pipelines[0]['app_data']['version'] = 2;
    return pipelineJSON;
  }

  private static convertPipelineV2toV3(
    pipelineJSON: any,
    pipelinePath: string
  ): any {
    // No-Op this is to disable old versions of Elyra
    // to see a pipeline with Python Script nodes
    pipelineJSON.pipelines[0]['app_data']['version'] = 3;
    return pipelineJSON;
  }

  /**
   * Utility to create a one node pipeline to submit a single Notebook as a pipeline
   */
  static generateNotebookPipeline(
    filename: string,
    runtime_config: string,
    runtimeImage: string,
    dependencies: string[],
    envObject: { [key: string]: string }
  ): any {
    const template = JSON.parse(JSON.stringify(pipeline_template));
    const generated_uuid: string = Utils.getUUID();

    const artifactName = PathExt.basename(filename, PathExt.extname(filename));

    const envVars = Object.entries(envObject).map(
      ([key, val]) => `${key}=${val}`
    );

    template.id = generated_uuid;
    template.primary_pipeline = generated_uuid;
    template.pipelines[0].id = generated_uuid;

    template.pipelines[0].nodes[0].id = generated_uuid;
    template.pipelines[0].nodes[0].app_data.filename = filename;
    template.pipelines[0].nodes[0].app_data.runtime_image = runtimeImage;
    template.pipelines[0].nodes[0].app_data.env_vars = envVars;
    template.pipelines[0].nodes[0].app_data.dependencies = dependencies;

    template.pipelines[0].app_data.name = artifactName;
    template.pipelines[0].app_data.runtime = 'kfp';
    template.pipelines[0].app_data['runtime-config'] = runtime_config;
    template.pipelines[0].app_data.version = PIPELINE_CURRENT_VERSION;

    return template;
  }

  /**
   * Check if the provided pipeline is empty (no nodes)
   *
   * @param pipelineDefinition
   */
  static isEmptyPipeline(pipelineDefinition: any): boolean {
    return Object.keys(pipelineDefinition.pipelines[0].nodes).length === 0;
  }

  /**
   * Check if the provided pipeline is clear of nodes and comments
   *
   * @param pipelineDefinition
   */
  static isEmptyCanvas(pipelineDefinition: any): boolean {
    return (
      this.isEmptyPipeline(pipelineDefinition) &&
      pipelineDefinition.pipelines[0].app_data.ui_data.comments.length === 0
    );
  }

  /**
   * Read the version of a Pipeline. If no version is found return 0
   *
   * @param pipelineDefinition
   */
  static getPipelineVersion(pipelineDefinition: any): number {
    let version = 0;

    if (pipelineDefinition)
      version =
        +this.getPipelineAppdataField(
          pipelineDefinition.pipelines[0],
          'version'
        ) || 0;

    return version;
  }

  /**
   * Read an application specific field from the pipeline definition
   * (e.g. pipelines[0][app_data][fieldName])
   */
  static getPipelineAppdataField(node: any, fieldName: string): string {
    if (this.hasPipelineAppdataField(node, fieldName)) {
      return node['app_data'][fieldName] as string;
    } else {
      return null;
    }
  }

  /**
   * Check if an application specific field from the pipeline defintion exists
   * (e.g. pipelines[0][app_data][fieldName])
   */
  static hasPipelineAppdataField(node: any, fieldName: string): boolean {
    return (
      Object.prototype.hasOwnProperty.call(node, 'app_data') &&
      Object.prototype.hasOwnProperty.call(node['app_data'], fieldName)
    );
  }

  /**
   * Delete an application specific field from the pipeline definition
   * (e.g. pipelines[0][app_data][fieldName])
   */
  static deletePipelineAppdataField(node: any, fieldName: string): void {
    if (this.hasPipelineAppdataField(node, fieldName)) {
      delete node['app_data'][fieldName];
    }
  }

  /**
   * Rename an application specific field from the pepileine definition if it exists by
   * by copying the field value to the new field name and then deleting the previously
   * existing field
   */
  static renamePipelineAppdataField(
    node: any,
    currentFieldName: string,
    newFieldName: string
  ): void {
    if (this.hasPipelineAppdataField(node, currentFieldName)) {
      node['app_data'][newFieldName] = node['app_data'][currentFieldName];
      this.deletePipelineAppdataField(node, currentFieldName);
    }
  }

  /**
   * Break an array into an array of "chunks", each "chunk" having "n" elements.
   * The final "chuck" may have less than "n" elements.
   * Example:
   * chunkArray(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 4)
   * -> [['a', 'b', 'c', 'd'], ['e', 'f', 'g']]
   */
  static chunkArray<T extends {}>(arr: T[], n: number): T[][] {
    return Array.from(Array(Math.ceil(arr.length / n)), (_, i) =>
      arr.slice(i * n, i * n + n)
    );
  }
}
