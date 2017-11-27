/**
 * Created by sunlin on 16/03/2017.
 */
import thunkMiddleware from 'redux-thunk';
import { createStore, applyMiddleware, combineReducers } from 'redux';

let indexKey = '__index__';
let prefix = '$';

let actions = null;
let reducers = null;
let pages = null;

// Create store

let storeInstance = null;
export const store = (...middlewares) => {
    if (storeInstance) return storeInstance;
    if (!reducers) return null;
    storeInstance = createStore(
        reducers,
        applyMiddleware(
            thunkMiddleware,
            ...middlewares,
        )
    )
    return storeInstance;
}

// reducer
const createReducer = (actionKeys) => {
    let keys = actionKeys;
    if (!Array.isArray(actionKeys) && typeof actionKeys === 'string') {
        keys = [actionKeys];
    }
    return (state = {}, action) => {
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
export const load = (ctlrs, path = '', converter = null, connecter = connect, withRouter = args => args) => {
    let loadedData = {isAction: false, reducer: null };
    if (typeof ctlrs === 'function') {
        if (!path || path === '') {
            actions = ctlrs;
        } else {
            const levels = path.split('.');
            let key = null;
            while (!key && levels.length > 0) {
                key = levels.pop();
            }
            if (!actions) actions = {};
            actions[path] = ctlrs;
            if (key) {
                const statusKey = `${key}Status`;
                const errorKey = `${key}Error`;
                Object.keys(actionStatuses).forEach(status => {
                    const statusValue = actionStatuses[status];
                    const type = `${path}.$${status}`;
                    let data = {};
                    data[statusKey] = statusValue;
                    if (status === 'done') {
                        actions[type] = (res) => {
                            data = Object.assign(data, res);
                            return { type, data };
                        }
                    } else if (status === 'error') {
                        actions[type] = (err) => {
                            data[errorKey] = err;
                            return { type, data };
                        }
                    } else {
                        actions[type] = () => ({ type, data });
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
        for (let key in ctlrs) {
            if (ctlrs.hasOwnProperty(key)) {
                if (isPrivateKey(key)) {
                    if (!instructors) instructors = {};
                    instructors[key] = ctlrs[key];
                } else {
                    const p = (path) ? path + '.' + key : key;
                    const result = load(ctlrs[key], p, converter, connecter, withRouter);
                    const { isAction, reducer } = result;
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
                    }
                }
            }
        }
        let reducer = (actionPaths) ? createReducer(actionPaths) : null;
        if (subReducers && reducer) {
            subReducers[indexKey] = reducer;
        }
        if (subReducers) {
            reducer = combineReducers(subReducers);
        }
        if (!path) reducers = reducer;
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
                if (!pages) pages = {};
                const pageKey = (path) ? path: indexKey;
                pages[pageKey] = withRouter(connecter(
                    (state) => {
                        return (state = {}) => {
                            let targets = null; 
                            for (let key in combinePaths) {
                                if (!combinePaths.hasOwnProperty(key)) continue;
                                const p = combinePaths[key];
                                if (!p) {
                                    if (key === '$this') targets = state;
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
                                    if (isPrivateKey(key)) {
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
                                const actionHandler = actions[actionKey];
                                if (actionHandler) {
                                    dispatchers[key] = async (...params) => {
                                        dispatch(actions[`${path}.${key}.$${actionStatuses.doing}`]());
                                        try {
                                            const res = await actionHandler(...params);
                                            dispatch(actions[`${path}.${key}.$${actionStatuses.done}`](res));
                                        } catch (error) {
                                            dispatch(actions[`${path}.${key}.$${actionStatuses.error}`](error));
                                        }
                                    }
                                }
                            }
                        }
                        return dispatchers;
                    }
                )(instructors[`${prefix}page`]));
            }
        }
        loadedData = { isAction: false, reducer}
    } else if (typeof converter === 'function') {
        loadedData = load(converter(ctlrs), path, converter, connecter, withRouter);
    }
    if (!path) {
        return pages;
    }

    return loadedData;
}
