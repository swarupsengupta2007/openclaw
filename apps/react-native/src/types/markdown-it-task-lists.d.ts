declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';

  interface MarkdownItTaskListsOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }

  type MarkdownItTaskListsPlugin = (md: MarkdownIt, options?: MarkdownItTaskListsOptions) => void;

  const markdownItTaskLists: MarkdownItTaskListsPlugin;
  export default markdownItTaskLists;
}
