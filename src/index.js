/**
 * Created by sunlin on 16/03/2017.
 */
import thunkMiddleware from 'redux-thunk';
import { createStore, applyMiddleware, combineReducers } from 'redux';
import co from 'co';

export let indexKey = '__index__';
export let prefix = '$';

const instance = {
    actions: null,
    reducers: null,
    pages: null,
    store: null,
}

// Create store
const createStoreInstance = (useReduxTool, ...middlewares) => {
    if (instance.store) return instance.store;
    if (!instance.reducers) return null;
    if (useReduxTool) {
        /* eslint-disable no-underscore-dangle */
        instance.store = createStore(
            instance.reducers,
            window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__(),
            applyMiddleware(
                thunkMiddleware,
                ...middlewares,
            )
        )
        /* eslint-enable */
    } else {
        instance.store = createStore(
            instance.reducers,
            applyMiddleware(
                thunkMiddleware,
                ...middlewares,
            )
        )
    }
    return instance.store;
};

export const store = (...middlewares) => {
    return createStoreInstance(false, ...middlewares);
}

export const storeWithTools = (...middlewares) => {
    return createStoreInstance(true, ...middlewares);
}

const dispatchAction = (dispatch, actionName, ...params) => {
    if (!instance.actions || !instance.store) 
        return dispatch({ type: 'error', data: 'Controllers not loaded yet'});

    if (typeof actionName !== 'string') 
        return dispatch({type: 'error', data: 'action name should be a string'});
    
    if (typeof instance.actions[actionName] !== 'function') 
        return dispatch({type: 'error', data: 'action does not exist'});

    const actionHandler = instance.actions[actionName];
    const handlerType = Object.prototype.toString.call(actionHandler);
    let promiseObj = null;
    dispatch(instance.actions[`${actionName}.$${actionStatuses.doing}`]());
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
                dispatch(instance.actions[`${actionName}.$${actionStatuses.done}`](res));
                return Promise.resolve(res);
            }
        } catch (err) {
            dispatch(instance.actions[`${actionName}.$${actionStatuses.error}`](err));
            return Promise.reject(err);
        }
    }
    if (promiseObj) {
        return promiseObj.then((res, err) => {
            dispatch(instance.actions[`${actionName}.$${actionStatuses.done}`](res));
            return res;
        }).catch((err) => {
            dispatch(instance.actions[`${actionName}.$${actionStatuses.error}`](err));
            throw err;
        });
    } else dispatch({ type: 'error', data: `unsupported action handler type: ${handlerType}` });
}

export const dispatch = (actionName, ...params) => {
    return dispatchAction(instance.store.dispatch, actionName, ...params);    
};

// reducer
const createReducer = (actionKeys, initState) => {
    let keys = actionKeys;
    if (!Array.isArray(actionKeys) && typeof actionKeys === 'string') {
        keys = [actionKeys];
    }
    return (state = initState || {}, action) => {
        if (keys.indexOf(action.type) >= 0 ) {
            return Object.assign({}, state, action.data);
            // return Object.assign(state, action.data);
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

// Assemble pages
const assemblePage = ({ connecter, withRouter, pageKey, combinePaths, reducerKeys, page, path }) => {
    let levels = pageKey.split('.');
    let pageSet = instance.pages;
    let pageName = pageKey;
    while (levels.length > 1) {
        pageName = levels.shift();
        if (!pageSet[pageName]) pageSet[pageName] = {};
        pageSet = pageSet[pageName];
    }
    pageName = levels[0];
    pageSet[pageName] = withRouter(connecter(
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
                    if (typeof instance.actions[actionKey] === 'function') {
                        dispatchers[key] = async (...params) => {
                            return await dispatchAction(dispatch, actionKey , ...params);
                        }
                    }
                }
            }
            return dispatchers;
        }
    )(page));
}
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
        loadedData = { isAction: true, reducer: null, state: null };
    } else if (!Array.isArray(ctlrs) 
                && Object.prototype.toString.call(ctlrs) === '[object Object]'
            ) {
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
                    } 
                    // State is combined with reducers, so they could exist at the same time
                    if (state !== null) {
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
                const page = instructors[`${prefix}page`];
                assemblePage({ connecter, withRouter, pageKey, combinePaths, reducerKeys, page, path });
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
