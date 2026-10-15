import { GetSessionInfo } from "@/action/staff.action"
import { useEffect, useState } from "react"

// Name of the gym the signed-in person is working in, for message texts.
export function useGymName(): string {
  const [name, setName] = useState("")
  useEffect(() => {
    GetSessionInfo().then((session) => setName(session?.gymName ?? ""))
  }, [])
  return name
}
