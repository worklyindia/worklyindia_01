/**
 * Guards against the classic "Failed to execute 'removeChild' on 'Node'" /
 * "insertBefore" crashes.
 *
 * These happen when something outside React rewrites the page's text nodes —
 * most often Chrome's / Google Translate's automatic page translation on
 * Android, but also password managers, ad blockers and in-app browsers.
 * React then tries to remove or move a node that is no longer where it left
 * it, throws a DOM exception during commit, and the whole screen is replaced
 * by the error fallback.
 *
 * The nodes involved are already gone (or already moved), so silently
 * ignoring the impossible operation is safe and keeps the page alive instead
 * of blowing up the entire route.
 */
export function installDomMutationGuard() {
  if (typeof Node === 'undefined') return;
  const proto = Node.prototype as unknown as Record<string, unknown> & {
    removeChild: <T extends Node>(child: T) => T;
    insertBefore: <T extends Node>(node: T, ref: Node | null) => T;
  };

  if ((proto as any).__lovableDomGuardInstalled) return;
  (proto as any).__lovableDomGuardInstalled = true;

  const originalRemoveChild = proto.removeChild;
  proto.removeChild = function patchedRemoveChild<T extends Node>(this: Node, child: T): T {
    if (child && child.parentNode !== this) {
      if (import.meta.env.DEV) {
        console.warn('[domMutationGuard] Ignored removeChild for a detached node');
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = proto.insertBefore;
  proto.insertBefore = function patchedInsertBefore<T extends Node>(
    this: Node,
    node: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (import.meta.env.DEV) {
        console.warn('[domMutationGuard] Ignored insertBefore with a detached reference node');
      }
      this.appendChild(node);
      return node;
    }
    return originalInsertBefore.call(this, node, referenceNode) as T;
  };
}
