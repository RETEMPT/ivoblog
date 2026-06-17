"use client";

import React, { createContext, useContext, useState } from "react";

export type OperationType =
  | "POST"
  | "CHATTER"
  | "CONFIG"
  | "GALLERY"
  | "FRIEND"
  | "sync_photowall"
  | "sync_friends"
  | "sync_projects"
  | "create_moment"
  | "publish_article";

export interface Operation {
  id: string;
  type: OperationType;
  label: string;
  description: string;
  timestamp: string;
  payload?: any;
  key?: string;
  value?: any;
}

type NewOperation = Omit<Operation, "id" | "timestamp" | "description"> &
  Partial<Pick<Operation, "id" | "timestamp" | "description">>;

interface OperationContextType {
  operations: Operation[];
  addOperation: (op: NewOperation) => void;
  removeOperation: (id: string) => void;
  clearOperations: () => void;
}

const OperationContext = createContext<OperationContextType | undefined>(undefined);

export function OperationProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = useState<Operation[]>([]);

  const addOperation = (op: NewOperation) => {
    const newOp: Operation = {
      ...op,
      id: op.id || Math.random().toString(36).slice(2, 11),
      description: op.description || op.label,
      timestamp: op.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setOperations((prev) => {
      const filtered = prev.filter((item) => !(item.type === newOp.type && item.label === newOp.label));
      return [...filtered, newOp];
    });
  };

  const removeOperation = (id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));
  };

  const clearOperations = () => setOperations([]);

  return (
    <OperationContext.Provider value={{ operations, addOperation, removeOperation, clearOperations }}>
      {children}
    </OperationContext.Provider>
  );
}

export const useOperations = () => {
  const context = useContext(OperationContext);
  if (!context) throw new Error("useOperations must be used within an OperationProvider");
  return context;
};
