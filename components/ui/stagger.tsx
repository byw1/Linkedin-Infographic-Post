"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { listItem, staggerFor } from "@/lib/motion";

/**
 * Grid/list whose children rise 8px in sequence. Per-child delay shrinks
 * automatically as the collection grows so total stagger stays under
 * ~400ms — a 30-item list that takes 1.2s to appear reads as broken, not
 * premium. Above 20 items the stagger drops to zero and everything
 * arrives together.
 */
export function StaggerList({
  children,
  count,
  className,
}: {
  children: React.ReactNode;
  count: number;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: staggerFor(count) } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={listItem} className={className}>
      {children}
    </motion.div>
  );
}
