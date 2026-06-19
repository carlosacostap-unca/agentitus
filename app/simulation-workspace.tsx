"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  addCustomerAction,
  approveDraftAction,
  submitCustomerMessageAction,
  updateTireStockAction,
} from "@/app/actions";
import {
  availabilityLabel,
  channelLabel,
  formatCurrency,
  intentLabel,
  type Channel,
  type Conversation,
  type Customer,
  type ErpEvidence,
  type Intent,
  type Message,
  type Service,
  type SimulationState,
  type Tire,
} from "@/lib/simulation";

type Screen = "instagram" | "whatsapp" | "hub" | "erp";

const quickPrompts = [
  "Hola, tenes 195/55 R16?",
  "Cuanto sale la 205/55 R16?",
  "Necesito balanceo y alineacion",
  "Quiero reservar dos cubiertas 185/65 R15",
];

const screens: Array<{ id: Screen; label: string; description: string }> = [
  { id: "instagram", label: "Instagram", description: "DM del cliente" },
  { id: "whatsapp", label: "WhatsApp", description: "Chat del cliente" },
  { id: "hub", label: "Hub ManyChat", description: "Inbox, chat y aprobacion" },
  { id: "erp", label: "ERP gomeria", description: "Stock, servicios y evidencia" },
];

const defaultComposer: Record<Channel, string> = {
  instagram: quickPrompts[0],
  whatsapp: quickPrompts[2],
};

export default function SimulationWorkspace({ initialState }: { initialState: SimulationState }) {
  const [state, setState] = useState<SimulationState>(initialState);
  const [activeScreen, setActiveScreen] = useState<Screen>("instagram");
  const [composerByChannel, setComposerByChannel] =
    useState<Record<Channel, string>>(defaultComposer);
  const [newCustomerByChannel, setNewCustomerByChannel] = useState<
    Record<Channel, { name: string; handle: string }>
  >({
    instagram: { name: "", handle: "@" },
    whatsapp: { name: "", handle: "+54 " },
  });

  const selectedConversation = useMemo(
    () =>
      state.conversations.find((conversation) => conversation.id === state.selectedConversationId) ??
      state.conversations[0],
    [state.conversations, state.selectedConversationId],
  );
  const selectedCustomer = state.customers.find(
    (customer) => customer.id === selectedConversation.customerId,
  );
  const instagramConversations = state.conversations.filter(
    (conversation) => conversation.channel === "instagram",
  );
  const whatsappConversations = state.conversations.filter(
    (conversation) => conversation.channel === "whatsapp",
  );
  const instagramConversation =
    selectedConversation.channel === "instagram"
      ? selectedConversation
      : instagramConversations[0];
  const whatsappConversation =
    selectedConversation.channel === "whatsapp"
      ? selectedConversation
      : whatsappConversations[0];
  const instagramCustomer = state.customers.find(
    (customer) => customer.id === instagramConversation?.customerId,
  );
  const whatsappCustomer = state.customers.find(
    (customer) => customer.id === whatsappConversation?.customerId,
  );

  function selectConversation(conversation: Conversation) {
    setState((current) => ({
      ...current,
      selectedConversationId: conversation.id,
    }));
  }

  function selectScreen(screen: Screen) {
    setActiveScreen(screen);
    const channel = screen === "instagram" || screen === "whatsapp" ? screen : undefined;
    const conversation = state.conversations.find((item) => item.channel === channel);
    if (conversation) {
      selectConversation(conversation);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, conversation: Conversation) {
    event.preventDefault();
    const body = composerByChannel[conversation.channel];
    const nextState = await submitCustomerMessageAction(conversation.id, body);
    setState(nextState);
    setComposerByChannel((current) => ({
      ...current,
      [conversation.channel]: "",
    }));
  }

  function handleComposerChange(channel: Channel, value: string) {
    setComposerByChannel((current) => ({
      ...current,
      [channel]: value,
    }));
  }

  async function handleApprove(conversationId: string, response?: string) {
    const nextState = await approveDraftAction(conversationId, response);
    setState(nextState);
  }

  async function handleStockChange(tireId: string, nextStock: number) {
    const nextState = await updateTireStockAction(tireId, nextStock);
    setState(nextState);
  }

  function handleNewCustomerChange(
    channel: Channel,
    field: "name" | "handle",
    value: string,
  ) {
    setNewCustomerByChannel((current) => ({
      ...current,
      [channel]: {
        ...current[channel],
        [field]: value,
      },
    }));
  }

  async function handleAddCustomer(event: FormEvent<HTMLFormElement>, channel: Channel) {
    event.preventDefault();
    const draft = newCustomerByChannel[channel];
    const nextState = await addCustomerAction(channel, draft.name, draft.handle);
    setState(nextState);
    setNewCustomerByChannel((current) => ({
      ...current,
      [channel]: {
        name: "",
        handle: channel === "instagram" ? "@" : "+54 ",
      },
    }));
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172033]">
      <header className="border-b border-[#d9dee7] bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[#50607a]">Agentitus</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#101828]">
                Simulador de atencion automatizada para gomeria
              </h1>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Metric label="Conversaciones" value={state.conversations.length.toString()} />
              <Metric
                label="Borradores"
                value={state.conversations
                  .filter((conversation) => conversation.status === "draft-ready")
                  .length.toString()}
              />
              <Metric
                label="ERP stock"
                value={state.inventory.reduce((sum, tire) => sum + tire.stock, 0).toString()}
              />
            </div>
          </div>

          <nav className="mt-4 grid gap-2 lg:grid-cols-4">
            {screens.map((screen) => (
              <button
                key={screen.id}
                type="button"
                onClick={() => selectScreen(screen.id)}
                className={`rounded-lg border p-3 text-left ${
                  activeScreen === screen.id
                    ? "border-[#1f6feb] bg-[#eaf2ff]"
                    : "border-[#d9dee7] bg-white hover:bg-[#f6f7f9]"
                }`}
              >
                <p className="text-sm font-semibold text-[#101828]">{screen.label}</p>
                <p className="mt-1 text-xs text-[#667085]">{screen.description}</p>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-5 py-5">
        {activeScreen === "instagram" && instagramConversation ? (
          <InstagramScreen
            composer={composerByChannel.instagram}
            conversation={instagramConversation}
            conversations={instagramConversations}
            customer={instagramCustomer}
            customers={state.customers}
            newCustomer={newCustomerByChannel.instagram}
            onAddCustomer={(event) => handleAddCustomer(event, "instagram")}
            onComposerChange={(value) => handleComposerChange("instagram", value)}
            onNewCustomerChange={(field, value) =>
              handleNewCustomerChange("instagram", field, value)
            }
            onPromptSelect={(value) => handleComposerChange("instagram", value)}
            onSelectConversation={selectConversation}
            onSubmit={(event) => handleSubmit(event, instagramConversation)}
          />
        ) : null}

        {activeScreen === "whatsapp" && whatsappConversation ? (
          <WhatsAppScreen
            composer={composerByChannel.whatsapp}
            conversation={whatsappConversation}
            conversations={whatsappConversations}
            customer={whatsappCustomer}
            customers={state.customers}
            newCustomer={newCustomerByChannel.whatsapp}
            onAddCustomer={(event) => handleAddCustomer(event, "whatsapp")}
            onComposerChange={(value) => handleComposerChange("whatsapp", value)}
            onNewCustomerChange={(field, value) =>
              handleNewCustomerChange("whatsapp", field, value)
            }
            onPromptSelect={(value) => handleComposerChange("whatsapp", value)}
            onSelectConversation={selectConversation}
            onSubmit={(event) => handleSubmit(event, whatsappConversation)}
          />
        ) : null}

        {activeScreen === "hub" ? (
          <HubScreen
            conversations={state.conversations}
            customers={state.customers}
            selectedConversation={selectedConversation}
            selectedCustomer={selectedCustomer}
            onApprove={handleApprove}
            onSelectConversation={selectConversation}
          />
        ) : null}

        {activeScreen === "erp" ? (
          <ErpScreen
            inventory={state.inventory}
            services={state.services}
            selectedConversation={selectedConversation}
            onStockChange={handleStockChange}
          />
        ) : null}
      </div>
    </main>
  );
}

function InstagramScreen({
  conversation,
  conversations,
  customer,
  customers,
  composer,
  newCustomer,
  onAddCustomer,
  onComposerChange,
  onNewCustomerChange,
  onPromptSelect,
  onSelectConversation,
  onSubmit,
}: {
  conversation: Conversation;
  conversations: Conversation[];
  customer: Customer | undefined;
  customers: Customer[];
  composer: string;
  newCustomer: { name: string; handle: string };
  onAddCustomer: (event: FormEvent<HTMLFormElement>) => void;
  onComposerChange: (value: string) => void;
  onNewCustomerChange: (field: "name" | "handle", value: string) => void;
  onPromptSelect: (value: string) => void;
  onSelectConversation: (conversation: Conversation) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d9dee7] bg-[#fafafa]">
      <SectionHeader
        label="Pantalla 1"
        title="Instagram"
        detail="Simulacion de mensajes directos del cliente"
      />
      <div className="grid min-h-[720px] gap-5 p-5 xl:grid-cols-[330px_1fr]">
        <aside className="space-y-4">
          <SocialContactsPanel
            channel="instagram"
            conversations={conversations}
            customers={customers}
            newCustomer={newCustomer}
            selectedConversationId={conversation.id}
            onAddCustomer={onAddCustomer}
            onNewCustomerChange={onNewCustomerChange}
            onSelectConversation={onSelectConversation}
          />
          <PromptPanel
            title="Enviar como cliente de Instagram"
            detail="Estos mensajes entran al Hub ManyChat como DM."
            onPromptSelect={onPromptSelect}
          />
        </aside>

        <div className="mx-auto flex min-h-[680px] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-[#d7d7d7] bg-white shadow-sm">
          <div className="border-b border-[#ececec] bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl text-[#111111]">‹</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[2px]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-bold text-[#111111]">
                    {customer?.avatar}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{customer?.handle}</p>
                  <p className="text-xs text-[#737373]">Activo ahora</p>
                </div>
              </div>
              <div className="flex gap-3 text-lg text-[#111111]">
                <span>⌕</span>
                <span>ⓘ</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-white px-4 py-5">
            <InstagramProfileIntro customer={customer} />
            {conversation.messages.length === 0 ? (
              <p className="pt-3 text-center text-sm text-[#8e8e8e]">
                Escribi un DM para iniciar la consulta.
              </p>
            ) : (
              conversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "customer" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-[20px] px-4 py-2 text-sm leading-5 ${
                      message.sender === "customer"
                        ? "bg-[#3797f0] text-white"
                        : "border border-[#efefef] bg-[#efefef] text-[#111111]"
                    }`}
                  >
                    <p>{message.body}</p>
                    <p
                      className={`mt-1 text-[11px] ${
                        message.sender === "customer" ? "text-[#dcefff]" : "text-[#8e8e8e]"
                      }`}
                    >
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form className="border-t border-[#ececec] bg-white p-3" onSubmit={onSubmit}>
            <div className="flex h-11 items-center gap-2 rounded-full border border-[#dbdbdb] px-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3797f0] text-sm font-bold text-white">
                +
              </span>
              <input
                value={composer}
                onChange={(event) => onComposerChange(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                placeholder="Mensaje..."
              />
              <button type="submit" className="text-sm font-semibold text-[#0095f6]">
                Enviar
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function WhatsAppScreen({
  conversation,
  conversations,
  customer,
  customers,
  composer,
  newCustomer,
  onAddCustomer,
  onComposerChange,
  onNewCustomerChange,
  onPromptSelect,
  onSelectConversation,
  onSubmit,
}: {
  conversation: Conversation;
  conversations: Conversation[];
  customer: Customer | undefined;
  customers: Customer[];
  composer: string;
  newCustomer: { name: string; handle: string };
  onAddCustomer: (event: FormEvent<HTMLFormElement>) => void;
  onComposerChange: (value: string) => void;
  onNewCustomerChange: (field: "name" | "handle", value: string) => void;
  onPromptSelect: (value: string) => void;
  onSelectConversation: (conversation: Conversation) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d9dee7] bg-[#e5ddd5]">
      <SectionHeader
        label="Pantalla 2"
        title="WhatsApp"
        detail="Simulacion de conversacion del cliente"
      />
      <div className="grid min-h-[720px] xl:grid-cols-[360px_1fr]">
        <aside className="border-b border-[#d1d7db] bg-[#f0f2f5] xl:border-b-0 xl:border-r">
          <div className="flex h-16 items-center justify-between bg-[#00a884] px-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                GC
              </div>
              <div>
                <p className="text-sm font-semibold">Gomeria Centro</p>
                <p className="text-xs text-white/80">WhatsApp Business</p>
              </div>
            </div>
            <span className="text-xl">⋮</span>
          </div>
          <div className="border-b border-[#d1d7db] bg-white p-3">
            <div className="rounded-lg bg-[#f0f2f5] px-3 py-2 text-sm text-[#667781]">
              Buscar o empezar un chat nuevo
            </div>
          </div>
          <div className="bg-white">
            {conversations.map((item) => {
              const itemCustomer = customers.find((candidate) => candidate.id === item.customerId);
              const latest = item.messages.at(-1);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectConversation(item)}
                  className={`flex w-full gap-3 border-b border-[#eef0f1] px-4 py-3 text-left ${
                    item.id === conversation.id ? "bg-[#e7f7f2]" : "bg-white hover:bg-[#f5f6f6]"
                  }`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-bold text-[#3b4a54]">
                    {itemCustomer?.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <p className="truncate font-semibold text-[#111b21]">{itemCustomer?.name}</p>
                      <p className="text-xs text-[#667781]">{latest?.timestamp ?? "Ahora"}</p>
                    </div>
                    <p className="truncate text-sm text-[#667781]">
                      {latest?.body ?? "Esperando mensaje del cliente"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="p-4">
            <SocialContactForm
              channel="whatsapp"
              newCustomer={newCustomer}
              onAddCustomer={onAddCustomer}
              onNewCustomerChange={onNewCustomerChange}
            />
          </div>
          <div className="px-4 pb-4">
            <PromptPanel
              title="Enviar como cliente de WhatsApp"
              detail="Estos mensajes entran al Hub ManyChat como chat de WhatsApp."
              onPromptSelect={onPromptSelect}
            />
          </div>
        </aside>

        <div className="grid min-h-[720px] grid-rows-[auto_1fr_auto]">
          <div className="flex h-16 items-center justify-between bg-[#f0f2f5] px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-bold text-[#3b4a54]">
                {customer?.avatar}
              </div>
              <div>
                <p className="font-semibold text-[#111b21]">{customer?.name}</p>
                <p className="text-xs text-[#667781]">{customer?.handle}</p>
              </div>
            </div>
            <div className="flex gap-5 text-lg text-[#54656f]">
              <span>⌕</span>
              <span>⋮</span>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto bg-[#efeae2] px-5 py-6">
            <div className="mx-auto max-w-[520px] rounded-lg bg-[#fff3c4] px-4 py-2 text-center text-xs leading-5 text-[#54656f]">
              Los mensajes y llamadas estan simulados para este prototipo.
            </div>
            {conversation.messages.length === 0 ? (
              <p className="pt-8 text-center text-sm text-[#667781]">
                Escribi un mensaje para enviarlo al Hub ManyChat.
              </p>
            ) : (
              conversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "customer" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[720px] rounded-lg px-3 py-2 text-sm leading-5 shadow-sm ${
                      message.sender === "customer"
                        ? "bg-[#d9fdd3] text-[#111b21]"
                        : "bg-white text-[#111b21]"
                    }`}
                  >
                    <p>{message.body}</p>
                    <p className="mt-1 text-right text-[11px] text-[#667781]">{message.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form className="flex h-16 items-center gap-3 bg-[#f0f2f5] px-4" onSubmit={onSubmit}>
            <button type="button" className="text-2xl text-[#54656f]">
              +
            </button>
            <input
              value={composer}
              onChange={(event) => onComposerChange(event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-white px-4 text-sm outline-none"
              placeholder="Escribe un mensaje"
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-[#00a884] px-5 text-sm font-semibold text-white hover:bg-[#008f72]"
            >
              Enviar
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function SocialContactsPanel({
  channel,
  conversations,
  customers,
  newCustomer,
  selectedConversationId,
  onAddCustomer,
  onNewCustomerChange,
  onSelectConversation,
}: {
  channel: Channel;
  conversations: Conversation[];
  customers: Customer[];
  newCustomer: { name: string; handle: string };
  selectedConversationId: string;
  onAddCustomer: (event: FormEvent<HTMLFormElement>) => void;
  onNewCustomerChange: (field: "name" | "handle", value: string) => void;
  onSelectConversation: (conversation: Conversation) => void;
}) {
  return (
    <div className="rounded-lg border border-[#d9dee7] bg-white">
      <div className="border-b border-[#e4e8ef] p-4">
        <p className="text-xs font-semibold uppercase text-[#50607a]">Usuarios</p>
        <h3 className="mt-1 text-sm font-semibold text-[#101828]">
          Clientes de {channelLabel(channel)}
        </h3>
      </div>
      <div className="max-h-[260px] overflow-y-auto">
        {conversations.map((conversation) => {
          const customer = customers.find((item) => item.id === conversation.customerId);
          const latest = conversation.messages.at(-1);

          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelectConversation(conversation)}
              className={`flex w-full gap-3 border-b border-[#eef0f1] px-4 py-3 text-left last:border-b-0 ${
                conversation.id === selectedConversationId
                  ? "bg-[#eef6ff]"
                  : "bg-white hover:bg-[#f8fafc]"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                  channel === "instagram"
                    ? "bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5]"
                    : "bg-[#00a884]"
                }`}
              >
                {customer?.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#101828]">{customer?.name}</p>
                <p className="truncate text-xs text-[#667085]">{customer?.handle}</p>
                <p className="mt-1 truncate text-xs text-[#98a2b3]">
                  {latest?.body ?? "Sin mensajes todavia"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-[#e4e8ef] p-4">
        <SocialContactForm
          channel={channel}
          newCustomer={newCustomer}
          onAddCustomer={onAddCustomer}
          onNewCustomerChange={onNewCustomerChange}
        />
      </div>
    </div>
  );
}

function SocialContactForm({
  channel,
  newCustomer,
  onAddCustomer,
  onNewCustomerChange,
}: {
  channel: Channel;
  newCustomer: { name: string; handle: string };
  onAddCustomer: (event: FormEvent<HTMLFormElement>) => void;
  onNewCustomerChange: (field: "name" | "handle", value: string) => void;
}) {
  return (
    <form className="space-y-2" onSubmit={onAddCustomer}>
      <p className="text-xs font-semibold uppercase text-[#50607a]">Agregar usuario</p>
      <input
        value={newCustomer.name}
        onChange={(event) => onNewCustomerChange("name", event.target.value)}
        className="h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm outline-none focus:border-[#1f6feb]"
        placeholder="Nombre del cliente"
      />
      <input
        value={newCustomer.handle}
        onChange={(event) => onNewCustomerChange("handle", event.target.value)}
        className="h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm outline-none focus:border-[#1f6feb]"
        placeholder={channel === "instagram" ? "@usuario" : "+54 383 ..."}
      />
      <button
        type="submit"
        className={`h-10 w-full rounded-md px-3 text-sm font-semibold text-white ${
          channel === "instagram" ? "bg-[#3797f0] hover:bg-[#237fda]" : "bg-[#00a884] hover:bg-[#008f72]"
        }`}
      >
        Agregar a {channelLabel(channel)}
      </button>
    </form>
  );
}

function HubScreen({
  conversations,
  customers,
  selectedConversation,
  selectedCustomer,
  onApprove,
  onSelectConversation,
}: {
  conversations: Conversation[];
  customers: Customer[];
  selectedConversation: Conversation;
  selectedCustomer: Customer | undefined;
  onApprove: (conversationId: string, response?: string) => void;
  onSelectConversation: (conversation: Conversation) => void;
}) {
  const pendingCount = conversations.filter((conversation) => conversation.status === "draft-ready").length;
  const deliveredCount = conversations.filter((conversation) => conversation.status === "delivered").length;

  return (
    <section className="overflow-hidden rounded-lg border border-[#d9dee7] bg-[#f8fafc]">
      <SectionHeader
        label="Pantalla 3"
        title="Hub de automatizacion"
        detail="Bandeja, chat, evidencia ERP y aprobacion"
      />
      <div className="grid min-h-[760px] xl:grid-cols-[330px_minmax(520px,1fr)]">
        <aside className="border-b border-[#d9dee7] bg-white xl:border-b-0 xl:border-r">
          <div className="border-b border-[#e4e8ef] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[#50607a]">Inbox</p>
                <h3 className="mt-1 text-lg font-semibold text-[#101828]">Conversaciones</h3>
              </div>
              <span className="rounded-md bg-[#eef6ff] px-2 py-1 text-xs font-semibold text-[#0f4ea8]">
                {pendingCount} pendientes
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Borrador" value={pendingCount.toString()} tone="warning" />
              <MiniMetric label="Entregadas" value={deliveredCount.toString()} tone="success" />
            </div>
            <div className="mt-4 rounded-md border border-[#d9dee7] bg-[#f8fafc] px-3 py-2 text-sm text-[#667085]">
              Buscar por cliente, canal o intencion
            </div>
          </div>

          <div className="divide-y divide-[#e4e8ef]">
          {conversations.map((conversation) => {
            const customer = customers.find((item) => item.id === conversation.customerId);
            const latest = conversation.messages.at(-1);
            const isSelected = conversation.id === selectedConversation.id;

            return (
              <InboxConversationButton
                key={conversation.id}
                conversation={conversation}
                customer={customer}
                isSelected={isSelected}
                latest={latest}
                onSelect={onSelectConversation}
              />
            );
          })}
          </div>
        </aside>

        <div className="grid min-h-[760px] grid-rows-[auto_1fr] border-b border-[#d9dee7] bg-white xl:border-b-0">
          <div className="border-b border-[#e4e8ef] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold text-white ${
                    selectedConversation.channel === "instagram"
                      ? "bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5]"
                      : "bg-[#00a884]"
                  }`}
                >
                  {selectedCustomer?.avatar}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#101828]">{selectedCustomer?.name}</p>
                    <ChannelPill channel={selectedConversation.channel} />
                    <StatusBadge status={selectedConversation.status} />
                  </div>
                  <p className="mt-1 text-sm text-[#667085]">
                    {selectedCustomer?.handle} - {selectedConversation.messages.length} mensajes
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <MiniMetric label="Intencion" value={intentLabel(selectedConversation.lastIntent)} />
                <MiniMetric
                  label="Medida"
                  value={selectedConversation.lastRequestedSize ?? "No detectada"}
                />
              </div>
            </div>
          </div>

          <div className="min-h-0">
            <TranscriptPanel
              conversation={selectedConversation}
              customer={selectedCustomer}
              onDraftSend={(response) => onApprove(selectedConversation.id, response)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function InboxConversationButton({
  conversation,
  customer,
  isSelected,
  latest,
  onSelect,
}: {
  conversation: Conversation;
  customer: Customer | undefined;
  isSelected: boolean;
  latest: Message | undefined;
  onSelect: (conversation: Conversation) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation)}
      className={`block w-full p-4 text-left ${
        isSelected ? "bg-[#eef6ff]" : "bg-white hover:bg-[#f6f7f9]"
      }`}
    >
      <div className="flex gap-3">
        <div
          className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${
            conversation.channel === "instagram"
              ? "bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5]"
              : "bg-[#00a884]"
          }`}
        >
          {customer?.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-[#101828]">{customer?.name}</p>
            <StatusBadge status={conversation.status} />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ChannelPill channel={conversation.channel} />
            <span className="text-xs text-[#667085]">{intentLabel(conversation.lastIntent)}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#667085]">
            {latest?.body ?? "Esperando primer mensaje"}
          </p>
        </div>
      </div>
    </button>
  );
}

function TranscriptPanel({
  conversation,
  customer,
  onDraftSend,
}: {
  conversation: Conversation;
  customer: Customer | undefined;
  onDraftSend: (response: string) => void;
}) {
  return (
    <div className="h-full min-h-[520px] overflow-y-auto p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#101828]">Transcript</h3>
        <span className="rounded-md bg-[#eef2f7] px-2 py-1 text-xs font-semibold text-[#50607a]">
          {channelLabel(conversation.channel)}
        </span>
      </div>
      {conversation.messages.length === 0 ? (
        <EmptyState
          title="Sin mensajes"
          detail="Cuando el cliente escriba desde Instagram o WhatsApp, la conversacion aparecera aqui."
        />
      ) : (
        <div className="space-y-3">
          {conversation.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "customer" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[78%] rounded-lg border px-4 py-3 text-sm leading-6 ${
                  message.sender === "customer"
                    ? "border-[#d9dee7] bg-white text-[#172033]"
                    : "border-[#cfe8d8] bg-[#e8f7ee] text-[#172033]"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-[#50607a]">
                    {message.sender === "customer" ? customer?.name : "Gomeria Centro"}
                  </span>
                  <span className="text-xs text-[#98a2b3]">{message.timestamp}</span>
                </div>
                <p>{message.body}</p>
              </div>
            </div>
          ))}
          {conversation.draft ? (
            <DraftReplyBubble
              key={conversation.draft.id}
              channel={conversation.channel}
              initialDraftText={conversation.draft.response}
              intent={conversation.draft.intent}
              onDraftSend={onDraftSend}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function DraftReplyBubble({
  channel,
  initialDraftText,
  intent,
  onDraftSend,
}: {
  channel: Channel;
  initialDraftText: string;
  intent: Intent;
  onDraftSend: (response: string) => void;
}) {
  const [draftText, setDraftText] = useState(initialDraftText);
  const canSend = draftText.trim().length > 0;

  return (
    <div className="flex justify-end">
      <div className="w-full max-w-[78%] rounded-lg border border-[#b7e4c7] bg-[#f0fbf4] p-4 text-sm text-[#172033]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-[#126c3d]">
              Gomeria Centro
            </span>
            <span className="rounded-md bg-[#fff4db] px-2 py-1 text-xs font-semibold text-[#8a5200]">
              Borrador editable
            </span>
          </div>
          <span className="text-xs font-semibold text-[#50607a]">
            {intentLabel(intent)}
          </span>
        </div>

        <textarea
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          className="min-h-28 w-full resize-y rounded-md border border-[#b7d7c1] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#16834a]"
          aria-label="Editar respuesta propuesta"
        />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#667085]">
            La respuesta se enviara a {channelLabel(channel)}.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canSend}
              onClick={() => onDraftSend(draftText)}
              className="h-10 rounded-md bg-[#16834a] px-5 text-sm font-semibold text-white hover:bg-[#126c3d] disabled:cursor-not-allowed disabled:bg-[#a7b4c4]"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelPill({ channel }: { channel: Channel }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-semibold ${
        channel === "instagram" ? "bg-[#fff0f7] text-[#b4236f]" : "bg-[#e8f7ee] text-[#126c3d]"
      }`}
    >
      {channelLabel(channel)}
    </span>
  );
}

function MiniMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-[#f6d48f] bg-[#fff8e6]"
      : tone === "success"
        ? "border-[#b7e4c7] bg-[#effaf3]"
        : "border-[#d9dee7] bg-white";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase text-[#667085]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#101828]">{value}</p>
    </div>
  );
}

function ErpScreen({
  inventory,
  services,
  selectedConversation,
  onStockChange,
}: {
  inventory: Tire[];
  services: Service[];
  selectedConversation: Conversation;
  onStockChange: (tireId: string, nextStock: number) => void;
}) {
  const totalStock = inventory.reduce((sum, tire) => sum + tire.stock, 0);
  const totalValue = inventory.reduce((sum, tire) => sum + tire.stock * tire.price, 0);
  const lowStockCount = inventory.filter((tire) => tire.availability === "low-stock").length;
  const outOfStockCount = inventory.filter((tire) => tire.availability === "out-of-stock").length;
  const availableCount = inventory.filter((tire) => tire.availability === "available").length;
  const latestEvidence = selectedConversation.draft?.evidence;

  return (
    <section className="overflow-hidden rounded-lg border border-[#d9dee7] bg-[#f8fafc]">
      <SectionHeader
        label="Pantalla 4"
        title="ERP de gomeria"
        detail="Inventario, servicios y datos consultados por el agente"
      />

      <div className="border-b border-[#d9dee7] bg-white p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <ErpMetric label="Unidades" value={totalStock.toString()} detail="Stock total" />
          <ErpMetric label="Valorizado" value={formatCurrency(totalValue)} detail="Inventario estimado" />
          <ErpMetric label="Disponible" value={availableCount.toString()} detail="Medidas con stock" tone="success" />
          <ErpMetric label="Stock bajo" value={lowStockCount.toString()} detail="Reponer pronto" tone="warning" />
          <ErpMetric label="Sin stock" value={outOfStockCount.toString()} detail="Consultar proveedor" tone="danger" />
        </div>
      </div>

      <div className="grid min-h-[720px] gap-5 p-5 xl:grid-cols-[minmax(620px,1.35fr)_430px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-[#d9dee7] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#e4e8ef] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[#50607a]">Inventario</p>
                <h3 className="mt-1 text-lg font-semibold text-[#101828]">Neumaticos</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#50607a]">
                  {inventory.length} SKUs
                </span>
                <span className="rounded-md bg-[#eef6ff] px-3 py-2 text-xs font-semibold text-[#0f4ea8]">
                  Edicion local
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[1.15fr_1fr_0.75fr_0.65fr_0.8fr] border-b border-[#e4e8ef] bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase text-[#667085]">
                  <span>Medida</span>
                  <span>Marca y modelo</span>
                  <span>Precio</span>
                  <span>Stock</span>
                  <span>Estado</span>
                </div>
                {inventory.map((tire) => (
                  <InventoryRow key={tire.id} tire={tire} onStockChange={onStockChange} />
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#d9dee7] bg-white">
            <div className="border-b border-[#e4e8ef] p-4">
              <p className="text-xs font-semibold uppercase text-[#50607a]">Taller</p>
              <h3 className="mt-1 text-lg font-semibold text-[#101828]">Servicios y turnos</h3>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {services.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-[#d9dee7] bg-white">
            <div className="border-b border-[#e4e8ef] p-4">
              <p className="text-xs font-semibold uppercase text-[#50607a]">Consulta del agente</p>
              <h3 className="mt-1 text-lg font-semibold text-[#101828]">Evidencia usada</h3>
            </div>
            <div className="p-4">
              {latestEvidence ? (
                <ErpEvidenceCard evidence={latestEvidence} conversation={selectedConversation} />
              ) : (
                <EmptyState
                  title="Sin consulta ERP"
                  detail="Cuando el agente responda una consulta, los registros usados apareceran aqui."
                />
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[#d9dee7] bg-white">
            <div className="border-b border-[#e4e8ef] p-4">
              <p className="text-xs font-semibold uppercase text-[#50607a]">Operacion</p>
              <h3 className="mt-1 text-lg font-semibold text-[#101828]">Estado del catalogo</h3>
            </div>
            <div className="space-y-3 p-4">
              <CatalogSignal
                label="Medidas disponibles"
                value={`${availableCount} de ${inventory.length}`}
                detail="Listas para responder stock y precio"
                tone="success"
              />
              <CatalogSignal
                label="Atencion requerida"
                value={`${lowStockCount + outOfStockCount} alertas`}
                detail="Stock bajo o sin stock"
                tone={lowStockCount + outOfStockCount > 0 ? "warning" : "success"}
              />
              <CatalogSignal
                label="Servicios publicados"
                value={services.length.toString()}
                detail="Usados para consultas de taller"
              />
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function ErpMetric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-[#b7e4c7] bg-[#effaf3]"
      : tone === "warning"
        ? "border-[#f6d48f] bg-[#fff8e6]"
        : tone === "danger"
          ? "border-[#f0b7b7] bg-[#fff1f1]"
          : "border-[#d9dee7] bg-[#f8fafc]";

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase text-[#667085]">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold text-[#101828]">{value}</p>
      <p className="mt-1 text-xs text-[#667085]">{detail}</p>
    </div>
  );
}

function ErpEvidenceCard({
  evidence,
  conversation,
}: {
  evidence: ErpEvidence;
  conversation: Conversation;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#d9dee7] bg-[#f8fafc] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-[#50607a]">Origen</p>
          <ChannelPill channel={conversation.channel} />
        </div>
        <p className="mt-3 text-sm font-semibold text-[#101828]">{intentLabel(conversation.lastIntent)}</p>
        <p className="mt-1 text-sm leading-5 text-[#667085]">{evidence.summary}</p>
      </div>

      {evidence.records.length > 0 ? (
        <div className="space-y-2">
          {evidence.records.map((record) =>
            "size" in record ? (
              <div key={record.id} className="rounded-lg border border-[#d9dee7] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">{record.size}</p>
                    <p className="mt-1 text-sm text-[#50607a]">
                      {record.brand} {record.model}
                    </p>
                  </div>
                  <StockBadge availability={record.availability} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniMetric label="Precio" value={formatCurrency(record.price)} />
                  <MiniMetric label="Stock" value={record.stock.toString()} />
                </div>
              </div>
            ) : (
              <div key={record.id} className="rounded-lg border border-[#d9dee7] p-3">
                <p className="text-sm font-semibold text-[#101828]">{record.name}</p>
                <p className="mt-1 text-sm text-[#50607a]">{record.priceRange}</p>
                <p className="mt-1 text-xs text-[#667085]">
                  {record.duration} - {record.availability}
                </p>
              </div>
            ),
          )}
        </div>
      ) : (
        <EmptyState title="Sin registros" detail="La consulta no encontro coincidencias en el ERP." />
      )}
    </div>
  );
}

function CatalogSignal({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-[#b7e4c7] bg-[#effaf3]"
      : tone === "warning"
        ? "border-[#f6d48f] bg-[#fff8e6]"
        : "border-[#d9dee7] bg-[#f8fafc]";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#101828]">{label}</p>
        <p className="text-sm font-semibold text-[#101828]">{value}</p>
      </div>
      <p className="mt-1 text-sm text-[#667085]">{detail}</p>
    </div>
  );
}

function StockBadge({ availability }: { availability: Tire["availability"] }) {
  const toneClass =
    availability === "available"
      ? "bg-[#e8f7ee] text-[#126c3d]"
      : availability === "low-stock"
        ? "bg-[#fff4db] text-[#8a5200]"
        : "bg-[#fff1f1] text-[#b42318]";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${toneClass}`}>
      {availabilityLabel(availability)}
    </span>
  );
}

function PromptPanel({
  title,
  detail,
  onPromptSelect,
}: {
  title: string;
  detail: string;
  onPromptSelect: (value: string) => void;
}) {
  return (
    <aside className="rounded-lg border border-[#d9dee7] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#101828]">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-[#667085]">{detail}</p>
      <div className="mt-4 grid gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPromptSelect(prompt)}
            className="rounded-md border border-[#d9dee7] px-3 py-2 text-left text-sm text-[#50607a] hover:bg-[#f6f7f9]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </aside>
  );
}

function InstagramProfileIntro({
  customer,
}: {
  customer: { name: string; handle: string; avatar: string } | undefined;
}) {
  return (
    <div className="border-b border-[#efefef] pb-5 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[3px]">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-lg font-bold text-[#111111]">
          {customer?.avatar}
        </div>
      </div>
      <p className="mt-3 font-semibold text-[#111111]">{customer?.name}</p>
      <p className="text-sm text-[#737373]">{customer?.handle}</p>
      <p className="mt-2 text-xs text-[#8e8e8e]">Cliente simulado para consulta de neumaticos</p>
    </div>
  );
}

function SectionHeader({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="border-b border-[#e4e8ef] bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase text-[#50607a]">{label}</p>
      <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-lg font-semibold text-[#101828]">{title}</h2>
        <p className="text-sm text-[#667085]">{detail}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d9dee7] bg-[#f8fafc] px-3 py-2">
      <p className="text-xs text-[#667085]">{label}</p>
      <p className="text-lg font-semibold text-[#101828]">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: Conversation["status"] }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-semibold ${
        status === "draft-ready" ? "bg-[#fff4db] text-[#8a5200]" : "bg-[#e8f7ee] text-[#126c3d]"
      }`}
    >
      {status === "draft-ready" ? "Borrador" : "Entregado"}
    </span>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-center">
      <p className="text-sm font-semibold text-[#101828]">{title}</p>
      <p className="mt-1 text-sm text-[#667085]">{detail}</p>
    </div>
  );
}

function InventoryRow({
  tire,
  onStockChange,
}: {
  tire: Tire;
  onStockChange: (tireId: string, nextStock: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1.15fr_1fr_0.75fr_0.65fr_0.8fr] items-center border-b border-[#e4e8ef] px-4 py-3 last:border-b-0">
      <div>
        <p className="text-sm font-semibold text-[#101828]">{tire.size}</p>
        <p className="mt-1 text-xs text-[#667085]">SKU {tire.id.replace("tire-", "")}</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-[#101828]">{tire.brand}</p>
        <p className="mt-1 text-sm text-[#50607a]">{tire.model}</p>
      </div>
      <p className="text-sm font-semibold text-[#172033]">{formatCurrency(tire.price)}</p>
      <label className="flex items-center">
        <input
          type="number"
          min={0}
          value={tire.stock}
          onChange={(event) => onStockChange(tire.id, Number(event.target.value))}
          className="h-9 w-20 rounded-md border border-[#cbd5e1] px-2 text-right text-sm font-semibold outline-none focus:border-[#1f6feb]"
        />
      </label>
      <StockBadge availability={tire.availability} />
    </div>
  );
}

function ServiceRow({ service }: { service: Service }) {
  return (
    <div className="rounded-lg border border-[#d9dee7] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#101828]">{service.name}</p>
          <p className="mt-1 text-sm text-[#50607a]">{service.priceRange}</p>
        </div>
        <span className="rounded-md bg-[#eef6ff] px-2 py-1 text-xs font-semibold text-[#0f4ea8]">
          {service.duration}
        </span>
      </div>
      <p className="mt-3 text-sm leading-5 text-[#667085]">{service.availability}</p>
    </div>
  );
}
