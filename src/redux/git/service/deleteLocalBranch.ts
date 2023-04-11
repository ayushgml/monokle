import {invokeIpc} from '@utils/ipc';

import {GitCreateDeleteLocalBranchParams} from '@shared/ipc/git';

/**
 * Example usage:
 *
 * ```
 * try {
 *   await deleteLocalBranch({localPath: 'some/path', branchName: 'some/branch/name'});
 * } catch (err) {
 *   console.log(err);
 * }
 * ```
 */
export const deleteLocalBranch = invokeIpc<GitCreateDeleteLocalBranchParams, void>('git:deleteLocalBranch');
