"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { chatCollection, contactCollection, waAccountDoc } from "@/lib/firestore-paths";
import { Chat, Contact, WaAccount, WithId } from "@/types/firestore";

interface ChatsContextType {
  account: WaAccount | null;
  chats: WithId<Chat>[];
  contactsMap: Record<string, Contact>;
  totalUnreadCount: number;
  loading: boolean;
  error: string | null;
}

const ChatsContext = createContext<ChatsContextType>({
  account: null,
  chats: [],
  contactsMap: {},
  totalUnreadCount: 0,
  loading: true,
  error: null,
});

export function ChatsProvider({
  waId,
  children,
}: {
  waId?: string;
  children: React.ReactNode;
}) {
  const [account, setAccount] = useState<WaAccount | null>(null);
  const [chats, setChats] = useState<WithId<Chat>[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState<boolean>(Boolean(waId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!waId) {
      setChats([]);
      setAccount(null);
      setContactsMap({});
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Account listener
    const unsubAccount = onSnapshot(
      doc(db, waAccountDoc(waId)),
      (snapshot) => {
        if (snapshot.exists()) {
          setAccount(snapshot.data() as WaAccount);
        } else {
          setAccount(null);
        }
      },
      (err) => console.error("Account listener error:", err)
    );

    // 2. Contacts metadata listener (names, photos)
    const unsubContacts = onSnapshot(
      collection(db, contactCollection(waId)),
      (snapshot) => {
        const map: Record<string, Contact> = {};
        snapshot.docs.forEach((docSnap) => {
          map[docSnap.id] = docSnap.data() as Contact;
        });
        setContactsMap(map);
      },
      (err) => console.error("Contacts listener error:", err)
    );

    // 3. Chats listener (the single real-time source of truth for chats & unread totals)
    const unsubChats = onSnapshot(
      collection(db, chatCollection(waId)),
      (snapshot) => {
        const list: WithId<Chat>[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Chat),
        }));

        list.sort((a, b) => (b.lastChatTime || 0) - (a.lastChatTime || 0));

        setChats(list);
        setLoading(false);
      },
      (err) => {
        console.error("Chats listener error in ChatsProvider:", err);
        setError("Failed to load contacts list.");
        setLoading(false);
      }
    );

    return () => {
      unsubAccount();
      unsubContacts();
      unsubChats();
    };
  }, [waId]);

  const totalUnreadCount = chats.reduce(
    (sum, c) => sum + (c.unreadCount || 0),
    0
  );

  return (
    <ChatsContext.Provider
      value={{
        account,
        chats,
        contactsMap,
        totalUnreadCount,
        loading,
        error,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
}

export function useChats() {
  return useContext(ChatsContext);
}
