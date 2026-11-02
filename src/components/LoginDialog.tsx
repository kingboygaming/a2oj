"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export function LoginDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  function closeDialog() {
    if (dialogRef.current?.open) setIsClosing(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-md px-2 py-1.5 text-[var(--cream)]/90 hover:bg-white/10"
      >
        Đăng nhập
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="login-dialog-title"
        data-closing={isClosing}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClose={() => setIsClosing(false)}
        className="login-dialog fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none overflow-y-auto bg-transparent p-4 backdrop:bg-slate-950/70"
      >
        <div
          onClick={(event) => {
            if (
              event.target instanceof Node &&
              !panelRef.current?.contains(event.target)
            ) {
              closeDialog();
            }
          }}
          className="flex min-h-full items-center justify-center"
        >
          <section
            ref={panelRef}
            onAnimationEnd={(event) => {
              if (isClosing && event.animationName === "login-dialog-out") {
                dialogRef.current?.close();
              }
            }}
            className="login-dialog-panel relative w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6 text-[var(--ink)] shadow-2xl"
          >
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Đóng đăng nhập"
              className="absolute right-4 top-4 rounded-md px-2 py-1 text-xl leading-none text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--ink)]"
            >
              &times;
            </button>
            <h2 id="login-dialog-title" className="pr-10 text-2xl font-semibold text-[var(--navy)]">
              Đăng nhập
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Đăng nhập để nộp bài và tham gia contest.
            </p>
            <LoginForm />
            <p className="mt-4 text-center text-sm text-[var(--muted)]">
              Chưa có tài khoản?{" "}
              <Link
                href="/register"
                onClick={closeDialog}
                className="font-medium text-[var(--teal)] hover:underline"
              >
                Đăng ký học sinh
              </Link>
            </p>
          </section>
        </div>
      </dialog>
    </>
  );
}
