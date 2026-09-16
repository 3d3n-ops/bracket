/**
 * Language preludes injected before user code so list/tree problems can be
 * expressed as arrays in tests. Kept as strings so they can be shipped into
 * a Worker / Pyodide without bundler gymnastics.
 */

export const JS_PRELUDE = `
class ListNode { constructor(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; } }
class TreeNode { constructor(val, left, right) { this.val = val === undefined ? 0 : val; this.left = left === undefined ? null : left; this.right = right === undefined ? null : right; } }

function __arrayToList(input) {
  const values = Array.isArray(input) ? input : (input && input.values) || [];
  const cyclePos = Array.isArray(input) ? -1 : (input && typeof input.cyclePos === "number" ? input.cyclePos : -1);
  let head = null, tail = null; const nodes = [];
  for (const v of values) { const n = new ListNode(v); nodes.push(n); if (!head) head = n; else tail.next = n; tail = n; }
  if (cyclePos >= 0 && tail) tail.next = nodes[cyclePos] || null;
  return head;
}
function __listToArray(head) {
  const out = []; const seen = new Set(); let n = head;
  while (n) { if (seen.has(n)) { out.push("<cycle>"); break; } seen.add(n); out.push(n.val); n = n.next; if (out.length > 10000) break; }
  return out;
}
function __arrayToTree(arr) {
  if (!arr || !arr.length || arr[0] == null) return null;
  const root = new TreeNode(arr[0]); const q = [root]; let i = 1;
  while (q.length && i < arr.length) {
    const n = q.shift();
    if (arr[i] != null) { n.left = new TreeNode(arr[i]); q.push(n.left); } i++;
    if (i < arr.length && arr[i] != null) { n.right = new TreeNode(arr[i]); q.push(n.right); } i++;
  }
  return root;
}
function __treeToArray(root) {
  if (!root) return []; const out = []; const q = [root];
  while (q.length) { const n = q.shift(); if (n) { out.push(n.val); q.push(n.left, n.right); } else out.push(null); }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
`;

export const PY_PRELUDE = `
# LeetCode-style implicit imports
from typing import *
import collections, itertools, heapq, math, bisect, functools, re, string
from collections import defaultdict, deque, Counter, OrderedDict
from functools import lru_cache, cache
from heapq import heappush, heappop
from itertools import permutations, combinations, accumulate
from bisect import bisect_left, bisect_right

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def __array_to_list(inp):
    values = inp if isinstance(inp, list) else (inp or {}).get("values", [])
    cycle = -1 if isinstance(inp, list) else (inp or {}).get("cyclePos", -1)
    head = tail = None
    nodes = []
    for v in values:
        n = ListNode(v)
        nodes.append(n)
        if head is None:
            head = n
        else:
            tail.next = n
        tail = n
    if cycle is not None and cycle >= 0 and tail is not None:
        tail.next = nodes[cycle] if cycle < len(nodes) else None
    return head

def __list_to_array(head):
    out = []
    seen = set()
    n = head
    while n is not None:
        if id(n) in seen:
            out.append("<cycle>")
            break
        seen.add(id(n))
        out.append(n.val)
        n = n.next
        if len(out) > 10000:
            break
    return out

def __array_to_tree(arr):
    if not arr or arr[0] is None:
        return None
    root = TreeNode(arr[0])
    q = [root]
    i = 1
    while q and i < len(arr):
        n = q.pop(0)
        if arr[i] is not None:
            n.left = TreeNode(arr[i]); q.append(n.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            n.right = TreeNode(arr[i]); q.append(n.right)
        i += 1
    return root

def __tree_to_array(root):
    if root is None:
        return []
    out = []
    q = [root]
    while q:
        n = q.pop(0)
        if n is not None:
            out.append(n.val); q.append(n.left); q.append(n.right)
        else:
            out.append(None)
    while out and out[-1] is None:
        out.pop()
    return out
`;

/** twoSum → two_sum */
export function camelToSnake(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").toLowerCase();
}
