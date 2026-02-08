import debounce from "lodash/debounce";
import throttle from "lodash/throttle";
import cloneDeep from "lodash/cloneDeep";
import merge from "lodash/merge";
import isEqual from "lodash/isEqual";
import orderBy from "lodash/orderBy";
import groupBy from "lodash/groupBy";
import mergeWith from "lodash/mergeWith";
import uniqBy from "lodash/uniqBy";

// Native implementation for simple utilities
export const _ = {
  throttle,
  debounce,
  each: (arr: any[], fn: (item: any, index: number) => void) => arr?.forEach(fn),
  flattenDeep: (arr: any[]) => arr?.flat(Infinity),
  omitBy: (obj: any, fn: (v: any, k: string) => boolean) =>
    Object.fromEntries(Object.entries(obj || {}).filter(([k, v]) => !fn(v, k))),
  isNil: (val: any) => val === null || val === undefined,
  keyBy: (arr: any[], key: string) =>
    Object.fromEntries(arr?.map(item => [item[key], item]) || []),
  mergeWith,
  cloneDeep,
  groupBy,
  get: (obj: any, path: string, defaultValue?: any) => {
    const result = String(path).split('.').reduce((acc, key) => acc?.[key], obj);
    return result === undefined ? defaultValue : result;
  },
  set: (obj: any, path: string, value: any) => {
    const keys = String(path).split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
  },
  remove: (arr: any[], fn: (item: any) => boolean) => {
    const removed = [];
    for (let i = arr.length - 1; i >= 0; i--) {
      if (fn(arr[i])) {
        removed.push(arr.splice(i, 1)[0]);
      }
    }
    return removed.reverse();
  },
  merge,
  isEqual,
  uniqWith: (arr: any[], fn: (a: any, b: any) => boolean) => {
    const result: any[] = [];
    arr?.forEach(item => {
      if (!result.some(res => fn(res, item))) result.push(item);
    });
    return result;
  },
  orderBy,
  pick: (obj: any, keys: string[]) =>
    Object.fromEntries(keys.filter(k => k in (obj || {})).map(k => [k, obj[k]])),
  difference: (arr1: any[], arr2: any[]) => arr1?.filter(x => !arr2?.includes(x)) || [],
  uniqBy
};

export default _;
