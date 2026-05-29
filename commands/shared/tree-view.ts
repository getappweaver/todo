import type { WebNode } from '@src/web/ui-schema';

export type TodoTreeViewItem = {
  id: number;
  text: string;
  depth: number;
  description: string | null;
  status: string;
};

export type TodoTreeNode<TItem extends TodoTreeViewItem> = {
  item: TItem;
  children: TodoTreeNode<TItem>[];
};

export type BuildTodoTreeProps<TItem extends TodoTreeViewItem> = {
  items: TItem[];
  startIndex: number;
};

export type BuildTodoTreeResult<TItem extends TodoTreeViewItem> = {
  nodes: TodoTreeNode<TItem>[];
  nextIndex: number;
};

export type RenderTodoTreeItemsProps<TItem extends TodoTreeViewItem> = {
  nodes: TodoTreeNode<TItem>[];
  renderSummary: (item: TItem) => WebNode;
  itemIdPrefix: string;
  itemUi: string;
  childrenClassName: string;
  defaultExpandedIds: Set<number>;
  storyTargetPrefix: string | null;
};

type RenderTodoTreeItemProps<TItem extends TodoTreeViewItem> = {
  node: TodoTreeNode<TItem>;
  renderSummary: (item: TItem) => WebNode;
  itemIdPrefix: string;
  itemUi: string;
  childrenClassName: string;
  defaultExpandedIds: Set<number>;
  storyTargetPrefix: string | null;
};

export function buildTodoTree<TItem extends TodoTreeViewItem>({
  items,
  startIndex,
}: BuildTodoTreeProps<TItem>): BuildTodoTreeResult<TItem> {
  const roots: TodoTreeNode<TItem>[] = [];
  let index = startIndex;

  while (index < items.length) {
    const item = items[index];
    const parentDepth = item.depth;
    index += 1;

    const children: TodoTreeNode<TItem>[] = [];
    while (index < items.length && items[index].depth > parentDepth) {
      const childResult = buildTodoTree({ items, startIndex: index });

      if (childResult.nodes.length > 0) {
        children.push(...childResult.nodes);
      }

      index = childResult.nextIndex;
    }

    roots.push({ item, children });

    if (index < items.length && items[index].depth < parentDepth) {
      break;
    }
  }

  return { nodes: roots, nextIndex: index };
}

function filterTextForItem(item: TodoTreeViewItem): string {
  return [item.text, item.description, item.status, `#${item.id}`]
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .join('\n');
}

function renderTodoTreeItem<TItem extends TodoTreeViewItem>({
  node,
  renderSummary,
  itemIdPrefix,
  itemUi,
  childrenClassName,
  defaultExpandedIds,
  storyTargetPrefix,
}: RenderTodoTreeItemProps<TItem>): WebNode {
  const item = node.item;

  return {
    type: 'element',
    tag: 'treeItem',
    props: {
      id: `${itemIdPrefix}${item.id}`,
      ui: itemUi,
      filterText: filterTextForItem(item),
      filterName: item.text,
      filterPath: `${item.id}`,
      defaultExpanded: defaultExpandedIds.has(item.id),
      ...(storyTargetPrefix === null
        ? {}
        : { storyTargetId: `${storyTargetPrefix}${item.id}` }),
    },
    summary: renderSummary(item),
    children: [
      ...(node.children.length > 0
        ? [
            {
              type: 'element' as const,
              /** Use `stack`, not nested `tree`, so only the root list gets bulk expand/collapse controls. */
              tag: 'stack' as const,
              props: {
                gap: 'xs' as const,
                className: childrenClassName,
              },
              children: renderTodoTreeItems({
                nodes: node.children,
                renderSummary,
                itemIdPrefix,
                itemUi,
                childrenClassName,
                defaultExpandedIds,
                storyTargetPrefix,
              }),
            },
          ]
        : []),
    ],
  };
}

export function renderTodoTreeItems<TItem extends TodoTreeViewItem>({
  nodes,
  renderSummary,
  itemIdPrefix,
  itemUi,
  childrenClassName,
  defaultExpandedIds,
  storyTargetPrefix,
}: RenderTodoTreeItemsProps<TItem>): WebNode[] {
  return nodes.map((node) =>
    renderTodoTreeItem({
      node,
      renderSummary,
      itemIdPrefix,
      itemUi,
      childrenClassName,
      defaultExpandedIds,
      storyTargetPrefix,
    }),
  );
}
