import SimulationWorkspace from "./simulation-workspace";
import { getSimulationStateFromPocketBase } from "@/lib/pocketbase-data";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  const initialState = await getSimulationStateFromPocketBase();

  return <SimulationWorkspace initialState={initialState} />;
}
