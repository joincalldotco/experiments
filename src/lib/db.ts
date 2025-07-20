import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

export type User = { id: string; name: string };
export type Room = { id: string; users: RoomUser[] };

export type Data = {
  users: User[];
  rooms: Room[];
};

export type RoomUser = {
  userId: string;
  micActive: boolean;
  camActive: boolean;
  isShareScreen: boolean;
};

const adapter = new JSONFile<Data>("db.json");
const db = new Low<Data>(adapter, { users: [], rooms: [] });

export async function initDb() {
  await db.read();
  db.data ||= { users: [], rooms: [] };
  await db.write();
}

export default db;
