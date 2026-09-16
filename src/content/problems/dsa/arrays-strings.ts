import type { ProblemSeed } from "../types";

export const arraysAndStrings: ProblemSeed[] = [
  {
    slug: "two-sum",
    title: "Two Sum",
    kind: "dsa",
    difficulty: "easy",
    category: "Arrays & Hashing",
    tags: ["array", "hash-map"],
    promptMd: `Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers that add up to \`target\`.

You may assume each input has exactly one solution, and you may not use the same element twice. Return the indices in ascending order.

**Example**
\`\`\`
nums = [2, 7, 11, 15], target = 9  →  [0, 1]
\`\`\``,
    starterCode: {
      javascript: `function twoSum(nums, target) {\n  // your code here\n}\n`,
      python: `def two_sum(nums, target):\n    # your code here\n    pass\n`,
    },
    entryFn: "twoSum",
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
    ],
    hints: [
      "Brute force is O(n²). What information would let you find a partner for each number in O(1)?",
      "As you scan, store each number's index in a hash map. For each number, check whether `target - num` is already in the map.",
    ],
    solutionMd: `Single pass with a hash map from value → index. For each \`x\`, look up \`target - x\` before inserting \`x\`. O(n) time, O(n) space.`,
  },
  {
    slug: "valid-anagram",
    title: "Valid Anagram",
    kind: "dsa",
    difficulty: "easy",
    category: "Arrays & Hashing",
    tags: ["string", "hash-map", "counting"],
    promptMd: `Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an anagram of \`s\`, and \`false\` otherwise.`,
    starterCode: {
      javascript: `function isAnagram(s, t) {\n  // your code here\n}\n`,
      python: `def is_anagram(s, t):\n    # your code here\n    pass\n`,
    },
    entryFn: "isAnagram",
    tests: [
      { args: ["anagram", "nagaram"], expected: true },
      { args: ["rat", "car"], expected: false },
      { args: ["", ""], expected: true },
      { args: ["aacc", "ccac"], expected: false },
    ],
    hints: [
      "Two strings are anagrams when they have the same character counts.",
      "Sorting works in O(n log n); counting with a map or a 26-slot array is O(n).",
    ],
  },
  {
    slug: "group-anagrams",
    title: "Group Anagrams",
    kind: "dsa",
    difficulty: "medium",
    category: "Arrays & Hashing",
    tags: ["string", "hash-map", "sorting"],
    promptMd: `Given an array of strings, group the anagrams together. Return a list of groups; the order of groups and of strings inside a group does not matter.

**Example**
\`\`\`
["eat","tea","tan","ate","nat","bat"] → [["bat"],["nat","tan"],["ate","eat","tea"]]
\`\`\``,
    starterCode: {
      javascript: `function groupAnagrams(strs) {\n  // your code here\n}\n`,
      python: `def group_anagrams(strs):\n    # your code here\n    pass\n`,
    },
    entryFn: "groupAnagrams",
    tests: [
      {
        args: [["eat", "tea", "tan", "ate", "nat", "bat"]],
        expected: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]],
        unordered: true,
      },
      { args: [[""]], expected: [[""]], unordered: true },
      { args: [["a"]], expected: [["a"]], unordered: true },
    ],
    hints: [
      "What key would two anagrams share? Think of a canonical form.",
      "Use the sorted string, or a 26-count signature, as the hash-map key.",
    ],
  },
  {
    slug: "top-k-frequent",
    title: "Top K Frequent Elements",
    kind: "dsa",
    difficulty: "medium",
    category: "Arrays & Hashing",
    tags: ["heap", "bucket-sort", "hash-map"],
    promptMd: `Given an integer array \`nums\` and an integer \`k\`, return the \`k\` most frequent elements. The answer is guaranteed to be unique; return it in any order.`,
    starterCode: {
      javascript: `function topKFrequent(nums, k) {\n  // your code here\n}\n`,
      python: `def top_k_frequent(nums, k):\n    # your code here\n    pass\n`,
    },
    entryFn: "topKFrequent",
    tests: [
      { args: [[1, 1, 1, 2, 2, 3], 2], expected: [1, 2], unordered: true },
      { args: [[1], 1], expected: [1], unordered: true },
      { args: [[4, 4, 4, 5, 5, 6, 7, 7, 7, 7], 2], expected: [7, 4], unordered: true },
    ],
    hints: [
      "Count frequencies first. Then how do you pick the top k without fully sorting?",
      "A min-heap of size k gives O(n log k). Bucket sort by frequency gives O(n).",
    ],
  },
  {
    slug: "product-except-self",
    title: "Product of Array Except Self",
    kind: "dsa",
    difficulty: "medium",
    category: "Arrays & Hashing",
    tags: ["array", "prefix-sum"],
    promptMd: `Given an integer array \`nums\`, return an array \`answer\` such that \`answer[i]\` is the product of all elements except \`nums[i]\`. You must do it in O(n) **without using division**.`,
    starterCode: {
      javascript: `function productExceptSelf(nums) {\n  // your code here\n}\n`,
      python: `def product_except_self(nums):\n    # your code here\n    pass\n`,
    },
    entryFn: "productExceptSelf",
    tests: [
      { args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6] },
      { args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0] },
      { args: [[2, 3]], expected: [3, 2] },
    ],
    hints: [
      "The answer at i is (product of everything left of i) × (product of everything right of i).",
      "Build prefix products left-to-right, then multiply in suffix products right-to-left using a running variable.",
    ],
  },
  {
    slug: "longest-consecutive-sequence",
    title: "Longest Consecutive Sequence",
    kind: "dsa",
    difficulty: "medium",
    category: "Arrays & Hashing",
    tags: ["hash-set", "array"],
    promptMd: `Given an unsorted array of integers, return the length of the longest run of consecutive integers. Your algorithm must run in O(n).`,
    starterCode: {
      javascript: `function longestConsecutive(nums) {\n  // your code here\n}\n`,
      python: `def longest_consecutive(nums):\n    # your code here\n    pass\n`,
    },
    entryFn: "longestConsecutive",
    tests: [
      { args: [[100, 4, 200, 1, 3, 2]], expected: 4 },
      { args: [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], expected: 9 },
      { args: [[]], expected: 0 },
      { args: [[1, 2, 0, 1]], expected: 3 },
    ],
    hints: [
      "Put everything in a set. A number starts a sequence only if num-1 is not in the set.",
      "Only extend from sequence starts; each number is visited at most twice → O(n).",
    ],
  },
  {
    slug: "valid-palindrome",
    title: "Valid Palindrome",
    kind: "dsa",
    difficulty: "easy",
    category: "Two Pointers",
    tags: ["string", "two-pointers"],
    promptMd: `A phrase is a palindrome if, after converting to lowercase and removing all non-alphanumeric characters, it reads the same forward and backward. Return \`true\` if \`s\` is a palindrome.`,
    starterCode: {
      javascript: `function isPalindrome(s) {\n  // your code here\n}\n`,
      python: `def is_palindrome(s):\n    # your code here\n    pass\n`,
    },
    entryFn: "isPalindrome",
    tests: [
      { args: ["A man, a plan, a canal: Panama"], expected: true },
      { args: ["race a car"], expected: false },
      { args: [" "], expected: true },
      { args: ["0P"], expected: false },
    ],
    hints: [
      "Two pointers from both ends, skipping non-alphanumerics.",
    ],
  },
  {
    slug: "three-sum",
    title: "3Sum",
    kind: "dsa",
    difficulty: "medium",
    category: "Two Pointers",
    tags: ["array", "two-pointers", "sorting"],
    promptMd: `Given an integer array \`nums\`, return all unique triplets \`[a, b, c]\` such that \`a + b + c == 0\`. The solution set must not contain duplicate triplets. Return each triplet sorted ascending.`,
    starterCode: {
      javascript: `function threeSum(nums) {\n  // your code here\n}\n`,
      python: `def three_sum(nums):\n    # your code here\n    pass\n`,
    },
    entryFn: "threeSum",
    tests: [
      { args: [[-1, 0, 1, 2, -1, -4]], expected: [[-1, -1, 2], [-1, 0, 1]], unordered: true },
      { args: [[0, 1, 1]], expected: [], unordered: true },
      { args: [[0, 0, 0]], expected: [[0, 0, 0]], unordered: true },
    ],
    hints: [
      "Sort first. Fix one element, then the problem becomes Two Sum on a sorted array.",
      "Use two pointers for the remaining pair and skip duplicates on all three positions.",
    ],
  },
  {
    slug: "container-most-water",
    title: "Container With Most Water",
    kind: "dsa",
    difficulty: "medium",
    category: "Two Pointers",
    tags: ["array", "two-pointers", "greedy"],
    promptMd: `Given \`height[i]\` describing vertical lines, find two lines that together with the x-axis form a container holding the most water. Return the maximum area.`,
    starterCode: {
      javascript: `function maxArea(height) {\n  // your code here\n}\n`,
      python: `def max_area(height):\n    # your code here\n    pass\n`,
    },
    entryFn: "maxArea",
    tests: [
      { args: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49 },
      { args: [[1, 1]], expected: 1 },
      { args: [[4, 3, 2, 1, 4]], expected: 16 },
    ],
    hints: [
      "Start with the widest container. Which side should you move inward, and why is it safe?",
      "Always move the shorter side — the taller side can never limit a better answer with the current shorter one.",
    ],
  },
  {
    slug: "longest-substring-no-repeat",
    title: "Longest Substring Without Repeating Characters",
    kind: "dsa",
    difficulty: "medium",
    category: "Sliding Window",
    tags: ["string", "sliding-window", "hash-set"],
    promptMd: `Given a string \`s\`, return the length of the longest substring without repeating characters.`,
    starterCode: {
      javascript: `function lengthOfLongestSubstring(s) {\n  // your code here\n}\n`,
      python: `def length_of_longest_substring(s):\n    # your code here\n    pass\n`,
    },
    entryFn: "lengthOfLongestSubstring",
    tests: [
      { args: ["abcabcbb"], expected: 3 },
      { args: ["bbbbb"], expected: 1 },
      { args: ["pwwkew"], expected: 3 },
      { args: [""], expected: 0 },
    ],
    hints: [
      "Maintain a window [l, r] with no repeats. When s[r] repeats, shrink from the left.",
      "Store the last index of each char so you can jump l directly instead of shrinking one by one.",
    ],
  },
  {
    slug: "best-time-buy-sell",
    title: "Best Time to Buy and Sell Stock",
    kind: "dsa",
    difficulty: "easy",
    category: "Sliding Window",
    tags: ["array", "greedy"],
    promptMd: `Given \`prices[i]\` for day i, choose one day to buy and a later day to sell to maximize profit. Return the max profit (0 if none).`,
    starterCode: {
      javascript: `function maxProfit(prices) {\n  // your code here\n}\n`,
      python: `def max_profit(prices):\n    # your code here\n    pass\n`,
    },
    entryFn: "maxProfit",
    tests: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5 },
      { args: [[7, 6, 4, 3, 1]], expected: 0 },
      { args: [[2, 4, 1]], expected: 2 },
    ],
    hints: ["Track the minimum price seen so far; profit today is price - min."],
  },
  {
    slug: "minimum-window-substring",
    title: "Minimum Window Substring",
    kind: "dsa",
    difficulty: "hard",
    category: "Sliding Window",
    tags: ["string", "sliding-window", "hash-map"],
    promptMd: `Given strings \`s\` and \`t\`, return the minimum window substring of \`s\` that contains every character of \`t\` (including duplicates). Return \`""\` if none exists.`,
    starterCode: {
      javascript: `function minWindow(s, t) {\n  // your code here\n}\n`,
      python: `def min_window(s, t):\n    # your code here\n    pass\n`,
    },
    entryFn: "minWindow",
    tests: [
      { args: ["ADOBECODEBANC", "ABC"], expected: "BANC" },
      { args: ["a", "a"], expected: "a" },
      { args: ["a", "aa"], expected: "" },
    ],
    hints: [
      "Expand right until the window satisfies t, then shrink left while it still does.",
      "Keep a count of how many required characters are currently satisfied to check validity in O(1).",
    ],
  },
  {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    kind: "dsa",
    difficulty: "easy",
    category: "Stack",
    tags: ["stack", "string"],
    promptMd: `Given a string containing only \`()[]{}\`, determine whether it is valid: every opening bracket is closed by the same type in the correct order.`,
    starterCode: {
      javascript: `function isValid(s) {\n  // your code here\n}\n`,
      python: `def is_valid(s):\n    # your code here\n    pass\n`,
    },
    entryFn: "isValid",
    tests: [
      { args: ["()"], expected: true },
      { args: ["()[]{}"], expected: true },
      { args: ["(]"], expected: false },
      { args: ["([)]"], expected: false },
      { args: ["{[]}"], expected: true },
      { args: ["]"], expected: false },
    ],
    hints: ["Push openers; on a closer, the top of the stack must be the matching opener."],
  },
  {
    slug: "daily-temperatures",
    title: "Daily Temperatures",
    kind: "dsa",
    difficulty: "medium",
    category: "Stack",
    tags: ["monotonic-stack", "array"],
    promptMd: `Given \`temperatures\`, return an array where \`answer[i]\` is the number of days until a warmer temperature, or 0 if there is none.`,
    starterCode: {
      javascript: `function dailyTemperatures(temperatures) {\n  // your code here\n}\n`,
      python: `def daily_temperatures(temperatures):\n    # your code here\n    pass\n`,
    },
    entryFn: "dailyTemperatures",
    tests: [
      { args: [[73, 74, 75, 71, 69, 72, 76, 73]], expected: [1, 1, 4, 2, 1, 1, 0, 0] },
      { args: [[30, 40, 50, 60]], expected: [1, 1, 1, 0] },
      { args: [[30, 60, 90]], expected: [1, 1, 0] },
    ],
    hints: [
      "Keep a stack of indices with decreasing temperatures.",
      "When a warmer day arrives, pop all cooler indices and record the distance.",
    ],
  },
  {
    slug: "binary-search",
    title: "Binary Search",
    kind: "dsa",
    difficulty: "easy",
    category: "Binary Search",
    tags: ["binary-search", "array"],
    promptMd: `Given a sorted array of distinct integers and a \`target\`, return its index or \`-1\` if not present. Must be O(log n).`,
    starterCode: {
      javascript: `function search(nums, target) {\n  // your code here\n}\n`,
      python: `def search(nums, target):\n    # your code here\n    pass\n`,
    },
    entryFn: "search",
    tests: [
      { args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
      { args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
      { args: [[5], 5], expected: 0 },
      { args: [[], 1], expected: -1 },
    ],
    hints: ["Be precise about your invariant: is the target in [lo, hi] or [lo, hi)?"],
  },
  {
    slug: "search-rotated-array",
    title: "Search in Rotated Sorted Array",
    kind: "dsa",
    difficulty: "medium",
    category: "Binary Search",
    tags: ["binary-search", "array"],
    promptMd: `A sorted array of distinct integers was rotated at an unknown pivot. Given \`target\`, return its index or \`-1\`, in O(log n).`,
    starterCode: {
      javascript: `function searchRotated(nums, target) {\n  // your code here\n}\n`,
      python: `def search_rotated(nums, target):\n    # your code here\n    pass\n`,
    },
    entryFn: "searchRotated",
    tests: [
      { args: [[4, 5, 6, 7, 0, 1, 2], 0], expected: 4 },
      { args: [[4, 5, 6, 7, 0, 1, 2], 3], expected: -1 },
      { args: [[1], 0], expected: -1 },
      { args: [[3, 1], 1], expected: 1 },
    ],
    hints: [
      "At any mid, at least one half is sorted. Determine which one.",
      "If the target lies inside the sorted half's range, search there; otherwise search the other half.",
    ],
  },
  {
    slug: "koko-bananas",
    title: "Koko Eating Bananas",
    kind: "dsa",
    difficulty: "medium",
    category: "Binary Search",
    tags: ["binary-search", "binary-search-on-answer"],
    promptMd: `Koko has \`piles\` of bananas and \`h\` hours. Each hour she eats up to \`k\` bananas from one pile. Return the minimum integer \`k\` so she can finish all piles within \`h\` hours.`,
    starterCode: {
      javascript: `function minEatingSpeed(piles, h) {\n  // your code here\n}\n`,
      python: `def min_eating_speed(piles, h):\n    # your code here\n    pass\n`,
    },
    entryFn: "minEatingSpeed",
    tests: [
      { args: [[3, 6, 7, 11], 8], expected: 4 },
      { args: [[30, 11, 23, 4, 20], 5], expected: 30 },
      { args: [[30, 11, 23, 4, 20], 6], expected: 23 },
    ],
    hints: [
      "The answer is monotonic: if speed k works, every larger speed works too.",
      "Binary search k in [1, max(piles)] using a feasibility check that sums ceil(pile / k).",
    ],
  },
];
