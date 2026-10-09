import React, { useState, useMemo } from "react";
import { Chat, Contact, Message, WithId } from "@/types/firestore";

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  waId: string;
  messageToForward: WithId<Message> | null;
  chats: WithId<Chat>[];
  contactsMap: Record<string, Contact>;
  onForward: (targetPhone: string, message: WithId<Message>) => Promise<void>;
}

export function ForwardMessageModal({
  isOpen,
  onClose,
  waId,
  messageToForward,
  chats,
  contactsMap,
  onForward,
}: ForwardMessageModalProps) {
  const [search, setSearch] = useState("");
  const [forwardingTo, setForwardingTo] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    const s = search.toLowerCase();
    const phones = new Set(chats.map((c) => c.phone));
    Object.keys(contactsMap).forEach((p) => phones.add(p));

    const list = Array.from(phones).map((phone) => {
      const contact = contactsMap[phone];
      const name = contact?.display_name || contact?.name || phone;
      return { phone, name };
    });

    return list.filter(
      (c) => c.name.toLowerCase().includes(s) || c.phone.includes(s)
    );
  }, [chats, contactsMap, search]);

  if (!isOpen || !messageToForward) return null;

  const handleForward = async (phone: string, name: string) => {
    setForwardingTo(phone);
    try {
      await onForward(phone, messageToForward);
      setStatus(`Forwarded to ${name}!`);
      setTimeout(() => {
        setStatus(null);
        onClose();
      }, 1500);
    } catch (err) {
      setStatus("Failed to forward.");
      setTimeout(() => setStatus(null), 2000);
    } finally {
      setForwardingTo(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border-custom bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-border-custom px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Forward Message</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary focus:outline-none"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary"
          />
        </div>

        <div className="flex-1 overflow-y-auto max-h-64 px-4 pb-4">
          {filteredContacts.length === 0 ? (
            <div className="text-center text-xs text-text-muted">No contacts found.</div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map((c) => (
                <button
                  key={c.phone}
                  onClick={() => handleForward(c.phone, c.name)}
                  disabled={!!forwardingTo}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-surface-hover disabled:opacity-50"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-text-primary">{c.name}</span>
                    <span className="text-[10px] text-text-muted">{c.phone}</span>
                  </div>
                  {forwardingTo === c.phone && (
                    <span className="text-[10px] text-accent-active">Sending...</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {status && (
          <div className="border-t border-border-custom bg-surface-hover px-4 py-2 text-center text-xs font-medium text-text-primary">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
