/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-07-07 15:18:09
 * @modify date 2019-07-07 15:18:09
 * @desc [description]
 */

import thunkMiddleware from 'redux-thunk';
import { createStore, applyMiddleware, combineReducers } from 'redux';
import co from 'co';

const indexKey = '__INDEX__';
const prefix = '$';
const isPrivateKey = (key: any) => (typeof key === 'string' && key.length > prefix.length && key.slice(0, prefix.length) === prefix);

interface Action { type: string, data: string}
// interface ActionHandler { (): Action }
interface Dispatcher {(action: Action): any}
// interface Reducer { (state: any, action: Action): any}
export enum ActionStatuses {
    doing = 'doing', 
    done = 'done', 
    error = 'error',
};

interface PageSet {
    [key: string]: PageSet|any
}
interface Instance {
    actions: {[key: string]: any}|null  // four kinds of action handlers: doing, done, error, and the action true handler
    reducers: any
    pages: PageSet|null
    store: any
    domains: any
}

declare global {
    interface Window { __REDUX_DEVTOOLS_EXTENSION__: any; }
}

const instance: Instance = {
    actions: null,
    reducers: null,
    pages: null,
    store: null,
    domains: null,
}

// export class StateEngine {
    
// }

// Create store
const createStoreInstance = (useReduxTool:any, ...middlewares: any[]) => {
    if (instance.store) return instance.store;
    const emptyReducer = (state: any) => state;
    if (useReduxTool) {
        /* eslint-disable no-underscore-dangle */
        instance.store = createStore(
            instance.reducers || emptyReducer,
            window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__(),
            applyMiddleware(
                thunkMiddleware,
                ...middlewares,
            )
        )
        /* eslint-enable */
    } else {
        instance.store = createStore(
            instance.reducers || emptyReducer,
            applyMiddleware(
                thunkMiddleware,
                ...middlewares,
            )
        )
    }
    return instance.store;
};

export const store = (...middlewares: any[]) => {
    return createStoreInstance(false, ...middlewares);
}

export const storeWithTools = (...middlewares: any[]) => {
    return createStoreInstance(true, ...middlewares);
}

// dispatch any action according to its name, with a provided dispatcher
const dispatchAction = (dispatch: Dispatcher, actionName: string, ...params: any[]): Promise<any>|any => {
    if (!instance.actions || !instance.store) 
        return dispatch({ type: 'error', data: 'Controllers not loaded yet'});

    if (typeof actionName !== 'string') 
        return dispatch({type: 'error', data: 'action name should be a string'});
    
    if (typeof instance.actions[actionName] !== 'function') 
        return dispatch({type: 'error', data: 'action does not exist'});
        
    // Dispatch the action of 'doing', not the action itself,
    // here is just to indicate the action is going to be in 'doing' status
    // not the actual execution of the action
    dispatch(instance.actions[`${actionName}.$${ActionStatuses.doing}`]());

    // Execute the true action, according to its tpye: async, generator, promise, or pure function
    const actionHandler = instance.actions[actionName];
    const handlerType = Object.prototype.toString.call(actionHandler);
    let promiseObj = null;
    if (handlerType === '[object AsyncFunction]') {
        promiseObj = actionHandler(...params);
    } else if (handlerType === '[object GeneratorFunction]') {
        promiseObj = co(actionHandler(...params));
    } else if (handlerType === '[object Promise]') {
        promiseObj = actionHandler;
    } else if (handlerType === '[object Function]') {
        try {
            const res = actionHandler(...params);
            if (Object.prototype.toString.call(res) === '[object Promise]') {
                promiseObj = res;
            } else {
                // to indicate the action is done, with the response = res
                dispatch(instance.actions[`${actionName}.$${ActionStatuses.done}`](res));
                return Promise.resolve(res);
            }
        } catch (err) {
            // to indicate the action is broken with error
            dispatch(instance.actions[`${actionName}.$${ActionStatuses.error}`](err));
            return Promise.reject(err);
        }
    }
    if (promiseObj) {
        return promiseObj.then((res: any) => {
            // to indicate the action is done, with the response = res
            dispatch(instance.actions![`${actionName}.$${ActionStatuses.done}`](res));
            return res;
        }).catch((err: any) => {
            // to indicate the action is broken with error
            dispatch(instance.actions![`${actionName}.$${ActionStatuses.error}`](err));
            throw err;
        });
    } else dispatch({ type: 'error', data: `unsupported action handler type: ${handlerType}` });
}

// using redux default dispatcher to dispatch actions according to its absolute path(name)
export const dispatch = (actionName: string, ...params: any[]) => {
    return dispatchAction(instance.store.dispatch, actionName, ...params);    
};

// reducer, make the execution of any action handlers to update the current node state
const createReducer = (actionKeys: string[]|string, initState: any) => {
    let keys = actionKeys;
    if (!Array.isArray(actionKeys) && typeof actionKeys === 'string') {
        keys = [actionKeys];
    }
    return (state = initState || {}, action: Action) => {
        if (keys.indexOf(action.type) >= 0 ) {
            return Object.assign({}, state, action.data);
        }
        return state;
    }
};

// Assemble pages
interface AssemblePage {
    (params: {
        connecter: any,
        withRouter: any,
        pageKey: string, 
        combinePaths: {[key: string]: string}, 
        reducerKeys: string[]|null,
        page: any,
        path: string
    }): any
}
const assemblePage: AssemblePage = ({ connecter, withRouter, pageKey, combinePaths, reducerKeys, page, path }) => {
    let levels = pageKey.split('.');
    let pageSet = instance.pages!;
    let pageName = pageKey;
    while (levels.length > 1) {
        pageName = levels.shift()!;
        if (!pageSet[pageName]) pageSet[pageName] = {};
        pageSet = pageSet[pageName];
    }
    pageName = levels[0];
    pageSet[pageName] = withRouter(connecter(
        // using the interface of default connect function of redux
        // mapStateToProps?: (state, ownProps?) => Object
        (state: any = {}) => {
            let targets = null; 
            for (let key in combinePaths) {
                if (!combinePaths.hasOwnProperty(key)) continue;
                const p = combinePaths[key];
                if (!p) {
                    if (key === `${prefix}this`) targets = state;
                } else {
                    let x = state;
                    let subkey = key;
                    p.split('.').forEach(subp => {
                        if (subp && x.hasOwnProperty(subp)) {
                            x = x[subp];
                            subkey = subp;
                        }
                    })
                    if (!targets) targets = {};
                    if (key === `${prefix}this`) {
                        targets = x;
                    } else if (isPrivateKey(key)) {
                        targets[subkey] = x;
                    } else {
                        targets[key] = x;
                    }
                }
            }
            return targets || {};
        },
        // mapDispatchToProps?: Object | (dispatch, ownProps?) => Object
        (dispatch: Dispatcher) => {
            const dispatchers: {[key: string]: any} = {};
            if (reducerKeys) {
                for (let key of reducerKeys) {
                    const actionKey= (path) ? path + '.' + key : key;
                    if (typeof instance.actions![actionKey] === 'function') {
                        // dispatchers[key] = async (...params: any[]) => {
                        //     return await dispatchAction(dispatch, actionKey , ...params);
                        // }
                        // Maybe no need to use async at outside,
                        // if user knows the action is async, it will be awaited explicitly
                        dispatchers[key] = (...params: any[]) => {
                            return dispatchAction(dispatch, actionKey , ...params);
                        }
                    }
                }
            }
            return dispatchers;
        }
        // mergeProps,
        // options
    )(page));
}

// Action domain

class ActionDomain {
    levels: string[]
    domain: string

    constructor(path: string) {
        this.levels = path.split('.');
        let key = this.levels.pop();    // the last one is not useful
        let domainPath  = ''
        let level = 0;
        while (level < this.levels.length) {
            key = this.levels[level++];
            if (!domainPath) domainPath = key;
            else domainPath += `.${key}`;
        }
        this.domain = domainPath;
    }

    getState(key: string) {
        let state = instance.store.getState();
        let level = 0;
        while(level < this.levels.length) {
            const k = this.levels[level++];
            state = state[k];
        }
        if (key.indexOf('.') >0) {
            const levels = key.split('.');
            while(levels.length > 0) {
                const k = levels.shift()!;
                state = state[k];
            }
        } else {
            state = state[key];
        }
        return state;
    }

    [key: string]:any;
}

// Set action
const saveAction = (path: string, ctlrs: any) => {
    if (!instance.actions) instance.actions = {};
    // const handlerType = Object.prototype.toString.call(ctlrs);
    let ad = new ActionDomain(path);
    if (!instance.domains) instance.domains = {};
    if (!instance.domains[ad.domain]) {
        instance.domains[ad.domain] = ad;
    } else {
        ad = instance.domains[ad.domain];
    }
    const key = path.split('.').pop();
    if (!ad[key!]) {
        ad[key!] = (...params: any[]) => {
            return dispatchAction(instance.store.dispatch, path, ...params);
        }
    }
    // set doing, done, error actions
    if (key) {
        const statusKey = `${key}Status`;
        const errorKey = `${key}Error`;
        Object.keys(ActionStatuses).forEach((status: string) => {
            const statusValue = ActionStatuses[status as keyof typeof ActionStatuses];
            const type = `${path}.$${status}`;
            let data: {[key:string]: any} = {};
            data[statusKey] = statusValue;
            if (status === 'done') {
                instance.actions![type] = (res:any) => {
                    data = Object.assign(data, res);
                    return { type, data };
                }
            } else if (status === 'error') {
                instance.actions![type] = (err: any) => {
                    data[errorKey] = err;
                    return { type, data };
                }
            } else {
                instance.actions![type] = () => ({ type, data });
            }
        })
    }

    instance.actions[path] = ctlrs.bind(ad);
}

// load setting of controllers
export const load = (ctlrs: any, params: any): any => {
    const { path, converter, connecter, withRouter } = Object.assign({
        path: '',
        converter: (prop: any) => prop,
        connecter: () => (page: any) => page,
        withRouter: (args: any) => args,
    }, params);
    let loadedData: {isAction: boolean, reducer: any, state: any} = {isAction: false, reducer: null, state: null };
    
    if (typeof ctlrs === 'function' || Object.prototype.toString.call(ctlrs) === '[object Promise]') {
        if (!path || path === '') {
            instance.actions = ctlrs;
        } else {
            saveAction(path, ctlrs);
        }
        loadedData = { isAction: true, reducer: null, state: null };
    } else if (!Array.isArray(ctlrs) 
                && Object.prototype.toString.call(ctlrs) === '[object Object]'
            ) {
        let actionPaths = null;
        let subReducers: {[key:string]:any}|null = null;
        let instructors: {[key:string]:any}|null = null;
        let reducerKeys = null;
        let subStates: {[key:string]:any}|null = null;
        for (let key in ctlrs) {
            if (!ctlrs.hasOwnProperty(key)) continue
            if (isPrivateKey(key)) {
                if (!instructors) instructors = {};
                instructors[key] = ctlrs[key];
                continue
            }
            const p = (path) ? path + '.' + key : key;
            const result = load(ctlrs[key], { path: p, converter, connecter, withRouter });
            const { isAction, reducer, state } = result;
            if (isAction) {
                if (!reducerKeys) reducerKeys = [];
                reducerKeys.push(key);
                if (!actionPaths) actionPaths = [];
                Object.keys(ActionStatuses).forEach(s => {
                    actionPaths.push(`${p}.$${s}`);
                })
                actionPaths.push(p);
            } else  if(reducer) {
                if (!subReducers) subReducers = {};
                subReducers[key] = reducer;
            } 
            // State is combined with reducers, so they could exist at the same time
            if (state !== null) {
                if (!subStates) subStates = {};
                subStates[key] = state;
            }
        }
        let reducer = (actionPaths) ? createReducer(actionPaths, subStates) : null;
        if (subReducers && reducer) {
            subReducers[indexKey] = reducer;
        }
        if (subReducers) {
            reducer = combineReducers(subReducers);
        }
        if (!path) instance.reducers = reducer;
        // Connect page
        if (instructors) {
            if (typeof connecter === 'function' && instructors[`${prefix}page`]) {
                let combinePaths: {[key:string]:any} = { }
                combinePaths[`${prefix}this`] = path;
                if (instructors[`${prefix}combine`]) {
                    const combine = instructors[`${prefix}combine`];
                    if (Array.isArray(combine)) {
                        combine.forEach((p, i) => {
                            combinePaths[`${prefix}that_${i}`] = p;
                        })
                    } else if (typeof combine === 'object') {
                        // TODO: this maybe incorrect
                        combinePaths = Object.assign(combinePaths, combine);
                    } else if (typeof combine === 'string') {
                        combinePaths[`${prefix}that`] = combine;
                    }
                }
                if (!instance.pages) instance.pages = {};
                const pageKey = (path) ? path: indexKey;
                const page = instructors[`${prefix}page`];
                assemblePage({ connecter, withRouter, pageKey, combinePaths, reducerKeys, page, path });
            }
        }
        if (!reducer && !subStates) subStates = {};
        loadedData = { isAction: false, reducer, state: subStates}
    } else if (typeof converter === 'function') {
        const convertedValue = converter(ctlrs);
        if (typeof convertedValue === 'function') {
            loadedData = load(convertedValue, { path, converter, connecter, withRouter });
        } else {
            loadedData.state = ctlrs;
        }
    } else {
        loadedData.state = ctlrs;
    }

    if (!path) {
        return instance.pages;
    }
    return loadedData;
}
