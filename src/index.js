/**
 * Created by sunlin on 16/03/2017.
 */
import thunkMiddleware from 'redux-thunk';
import { createStore, applyMiddleware, combineReducers } from 'redux';

export let indexKey = '__index__';
export let prefix = '$';

const instance = {
    actions: null,
    reducers: null,
    pages: null,
    store: null,
}

// Create store
export const store = (...middlewares) => {
    if (instance.store) return instance.store;
    if (!instance.reducers) return null;
    instance.store = createStore(
        instance.reducers,
        applyMiddleware(
            thunkMiddleware,
            ...middlewares,
        )
    )
    return instance.store;
}

const dispatchAction = async (dispatch, actionName, ...params) => {
    if (!actionName) throw 'Dispatching illegal action';
    const actionHandler = instance.actions[actionName];
    if (typeof actionHandler !== 'function') throw 'action does not exist';

    dispatch(instance.actions[`${actionName}.$${actionStatuses.doing}`]());
    try {
        const res = await actionHandler(...params);
        dispatch(instance.actions[`${actionName}.$${actionStatuses.done}`](res));
        return res;
    } catch (error) {
        dispatch(instance.actions[`${actionName}.$${actionStatuses.error}`](error));
        throw error;
    }
};

export const dispatch = async (actionName, ...params) => {
    if (!instance.actions || !instance.store) throw 'Controllers not loaded yet';
    if (typeof actionName !== 'string') throw 'action name should be a string';
    if (typeof instance.actions[actionName] !== 'function') throw 'action does not exist';
    return await dispatchAction(instance.store.dispatch, actionName, ...params);
}

// reducer
const createReducer = (actionKeys, initState) => {
    let keys = actionKeys;
    if (!Array.isArray(actionKeys) && typeof actionKeys === 'string') {
        keys = [actionKeys];
    }
    return (state = initState || {}, action) => {
        if (keys.indexOf(action.type) >= 0 ) {
            return Object.assign({}, state, action.data);
        }
        return state;
    }
};

const isPrivateKey = (key) => (typeof key === 'string' && key.length > prefix.length && key.slice(0, prefix.length) === prefix);
export const actionStatuses = {
    doing: 'doing', 
    done: 'done', 
    error: 'error',
};
// load setting of controllers
export const load = (ctlrs, params) => {
    const { path, converter, connecter, withRouter } = Object.assign({
        path: '',
        converter: prop => () => prop,
        connecter: () => {
            return page => page;
        },
        withRouter: args => args,
    }, params);
    let loadedData = {isAction: false, reducer: null, state: null };
    if (typeof ctlrs === 'function') {
        if (!path || path === '') {
            instance.actions = ctlrs;
        } else {
            const levels = path.split('.');
            let key = null;
            while (!key && levels.length > 0) {
                key = levels.pop();
            }
            if (!instance.actions) instance.actions = {};
            instance.actions[path] = ctlrs;
            if (key) {
                const statusKey = `${key}Status`;
                const errorKey = `${key}Error`;
                Object.keys(actionStatuses).forEach(status => {
                    const statusValue = actionStatuses[status];
                    const type = `${path}.$${status}`;
                    let data = {};
                    data[statusKey] = statusValue;
                    if (status === 'done') {
                        instance.actions[type] = (res) => {
                            data = Object.assign(data, res);
                            return { type, data };
                        }
                    } else if (status === 'error') {
                        instance.actions[type] = (err) => {
                            data[errorKey] = err;
                            return { type, data };
                        }
                    } else {
                        instance.actions[type] = () => ({ type, data });
                    }
                })
            }
        }
        loadedData = { isAction: true, reducer: null};
    } else if (typeof ctlrs === 'object') {
        let actionPaths = null;
        let subReducers = null;
        let instructors = null;
        let reducerKeys = null;
        let subStates = null;
        for (let key in ctlrs) {
            if (ctlrs.hasOwnProperty(key)) {
                if (isPrivateKey(key)) {
                    if (!instructors) instructors = {};
                    instructors[key] = ctlrs[key];
                } else {
                    const p = (path) ? path + '.' + key : key;
                    const result = load(ctlrs[key], { path: p, converter, connecter, withRouter });
                    const { isAction, reducer, state } = result;
                    if (isAction) {
                        if (!reducerKeys) reducerKeys = [];
                        reducerKeys.push(key);
                        if (!actionPaths) actionPaths = [];
                        Object.keys(actionStatuses).forEach(s => {
                            actionPaths.push(`${p}.$${s}`);
                        })
                        actionPaths.push(p);
                    } else  if(reducer) {
                        if (!subReducers) subReducers = {};
                        subReducers[key] = reducer;
                    } else if (state !== null) {
                        if (!subStates) subStates = {};
                        subStates[key] = state;
                    }
                }
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
                let combinePaths = { }
                combinePaths[`${prefix}this`] = path;
                if (instructors[`${prefix}combine`]) {
                    const combine = instructors[`${prefix}combine`];
                    if (Array.isArray(combine)) {
                        combine.forEach((p, i) => {
                            combinePaths[`${prefix}that_${i}`] = p;
                        })
                    } else if (typeof combine === 'object') {
                        combinePaths = Object.assign(combinePaths, combine);
                    } else if (typeof combine === 'string') {
                        combinePaths[`${prefix}that`] = combine;
                    }
                }
                if (!instance.pages) instance.pages = {};
                const pageKey = (path) ? path: indexKey;
                instance.pages[pageKey] = withRouter(connecter(
                    (state) => {
                        return (state = {}) => {
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
                        }
                    },
                    (dispatch) => {
                        const dispatchers = {};
                        if (reducerKeys) {
                            for (let key of reducerKeys) {
                                const actionKey= (path) ? path + '.' + key : key;
                                if (actionHandler) {
                                    dispatchers[key] = async (...params) => {
                                        return await dispatchAction(dispatch, actionKey , ...params);
                                    }
                                }
                            }
                        }
                        return dispatchers;
                    }
                )(instructors[`${prefix}page`]));
            }
        }
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
