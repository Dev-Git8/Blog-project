import { useParams } from 'react-router-dom'
import { Feed } from './Feed.jsx'

export function Tag() {
  const { tag } = useParams()
  return <Feed tag={tag} heading={`#${tag}`} intro={`Everything tagged ${tag}.`} />
}
