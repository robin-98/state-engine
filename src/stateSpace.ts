/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-07-10 11:13:27
 * @modify date 2019-07-10 11:13:27
 * @desc [description]
 */

export enum ActionStatus {
    doing = 'doing', 
    done = 'done', 
    error = 'error',
    idle = 'idle'
}

export interface KeyValue {
    [key:string]:any
}

export const getActionNameByStatus = (actionName: string, status: string):string => {
    const statusValue = (status in Object.keys(ActionStatus)) ? ActionStatus[status as keyof typeof ActionStatus] : status
    return `${actionName}.$${statusValue}`
}

export const getPropPath = (parentPath: string, propName: string) => {
    return parentPath ? parentPath + '.' + propName : propName
}

const identifyStateByAbsolutePath = (state: KeyValue = {}, path: string, customName: string = '') => {
    if (!path && !customName) return state
    
    const result: KeyValue = {}
    if (!path && customName) {
        result[customName] = state
    } else { // if (path)
        let segments = path.split('.')
        let parent = state
        for (let i = 0; i < segments.length - 1; i++) {
            parent = parent[segments[i]] || {}
        }
        const originalName = segments[segments.length - 1]
        if (!customName) result[originalName] = parent[originalName]
        else result[customName] = parent[originalName]
    }
    return result
}

export const mergeStateToProps = (currentPath: string, combines?: any) => {
    // mapStateToProps?: (state, ownProps?) => Object
    return (state: any = {}) => {
        let props = identifyStateByAbsolutePath(state, currentPath) 
        if (!combines) return props || {}

        let combinedPaths = (typeof combines === 'string') ? [combines] : combines
        if (Array.isArray(combinedPaths)) {
            for (let path of combinedPaths) {
                const combinedState = identifyStateByAbsolutePath(state, path)
                props = Object.assign(props || {}, combinedState)
            }
        } else if (Object.prototype.toString.call(combinedPaths) === '[object Object]') {
            for (let customName in combinedPaths) {
                const combinedState = identifyStateByAbsolutePath(state, combinedPaths[customName], customName)
                props = Object.assign(props || {}, combinedState)
            }
        }
        return props || {};
    }
}
export const mergeDispatchToProps = (customDispatcher: any, currentPath: string, originalActions: KeyValue) => {
    // mapDispatchToProps?: Object | (dispatch, ownProps?) => Object
    if (!originalActions) return () => ({})
    const actionNameSet = Object.keys(originalActions)
    if (actionNameSet.length === 0) return () => ({})
    return (dispatch: any) => {
        const dispatchers: KeyValue = {};
        for (let actionName of actionNameSet) {
            const actionPath = getPropPath(currentPath, actionName)
            dispatchers[actionName] = (...params: any[]) => {
                return customDispatcher(actionPath , ...params);
            }
            dispatchers[actionName].idle = () => {
                return dispatch({type: getActionNameByStatus(actionPath, ActionStatus.idle), data:{}})
            }
        }
        return dispatchers;
    }
}

// modified from combineReducers method of official redux package
export function combineSubReducers(currentReducer: any, subReducers: KeyValue) {
    const subReducerKeys = Object.keys(subReducers)
    return function combination(state:KeyValue = {}, payload: {type: string, data: any}) {
        let hasChanged = false
        const nextState = currentReducer(state, payload) || {}
        hasChanged = hasChanged || nextState !== state
        for (let i = 0; i < subReducerKeys.length; i++) {
            const key = subReducerKeys[i]
            const reducer = subReducers[key]
            const previousStateForKey = state[key]
            const nextStateForKey = reducer(previousStateForKey, payload) || {}
            nextState[key] = nextStateForKey
            hasChanged = hasChanged || nextStateForKey !== previousStateForKey
        }
        return hasChanged ? nextState : state
    }
}

export interface ActionPayload { type: string, data: string}
export const createNaiveReducer = (actionKeys: string[], initState: any) => {
    const actionKeyCache = new Map<string, boolean>(
        actionKeys.map(actKey => [actKey, true])
    )
    return (state = initState, payload: ActionPayload) => {
        if (actionKeyCache.has(payload.type)) {
            return Object.assign({}, state, payload.data)
        }
        return state
    }
}

export enum PropertyType {
    action = 'action',
    property = 'property',
    name = 'name',
    combine = 'combine',
    id = 'id',
    children = 'children',
    view = 'view',
    unknown = 'unknown'
}


export enum ActionType {
    sync = 'sync',
    async = 'async',
    generator = 'generator',
    promise = 'promise',
    unknown = 'unknown'
}

const isPrivateKey = (key: any): boolean => {
    return (typeof key === 'string' && key.length > 1 && key[0] === '$')
}

export const checkActionType = (action: any): ActionType => {
    if (!action) return ActionType.unknown
    if (Object.prototype.toString.call(action) === '[object Promise]') return ActionType.promise
    else if (Object.prototype.toString.call(action) === '[object AsyncFunction]') return ActionType.async
    else if (Object.prototype.toString.call(action) === '[object GeneratorFunction]') return ActionType.generator
    else if (Object.prototype.toString.call(action) === '[object Function]') return ActionType.sync
    else return ActionType.unknown
}

export const checkPropertyType = (prop: string, value: any): PropertyType => {
    if (!prop) return PropertyType.unknown
    if (isPrivateKey(prop)) {
        if (prop.toLowerCase() === '$name') return PropertyType.name
        else if (prop.toLowerCase() === '$id') return PropertyType.id
        else if (prop.toLowerCase() === '$combine') return PropertyType.combine
        else if (prop.toLowerCase() === '$children') return PropertyType.children
        else if (prop.toLowerCase() === '$view') return PropertyType.view
        else return PropertyType.unknown
    } else if (checkActionType(value) !== ActionType.unknown) {
        return PropertyType.action
    } else {
        return PropertyType.property
    }
}