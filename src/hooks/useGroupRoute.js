import { useContext } from 'react'
import { GroupRouteContext } from '../context/groupRouteContext'

export function useGroupRoute() {
  return useContext(GroupRouteContext)
}
