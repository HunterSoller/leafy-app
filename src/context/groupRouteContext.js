import { createContext } from 'react'

export const GroupRouteContext = createContext({
  activeGroupId: null,
  pathname: '/',
  locationKey: 'default',
})
