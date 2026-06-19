"use server";

import {
  approvePocketBaseDraft,
  createPocketBaseCustomer,
  submitPocketBaseCustomerMessage,
  updatePocketBaseTireStock,
} from "@/lib/pocketbase-data";
import type { Channel } from "@/lib/simulation";

export async function addCustomerAction(channel: Channel, name: string, handle: string) {
  return createPocketBaseCustomer(channel, name, handle);
}

export async function submitCustomerMessageAction(conversationId: string, body: string) {
  return submitPocketBaseCustomerMessage(conversationId, body);
}

export async function approveDraftAction(conversationId: string, response?: string) {
  return approvePocketBaseDraft(conversationId, response);
}

export async function updateTireStockAction(tireId: string, nextStock: number) {
  return updatePocketBaseTireStock(tireId, nextStock);
}
