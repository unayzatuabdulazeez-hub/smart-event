'use client';
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { normalizeNgPhone, whatsappLink } from '@/lib/whatsapp';
import { Button, Modal, TextArea, TextField } from './ui';

/** Click-to-chat only. The owner edits the message, then WhatsApp opens with it pre-filled. */
export default function WhatsAppDialog({ open, onClose, title, phone, message, onOpened }: {
  open: boolean; onClose: () => void; title: string; phone: string | null | undefined; message: string; onOpened?: () => void;
}) {
  const [text, setText] = useState(message);
  const [num, setNum] = useState(phone ?? '');
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) { setText(message); setNum(phone ?? ''); setCopied(false); } }, [open, message, phone]);
  const link = whatsappLink(num, text);
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <TextField label="WhatsApp number" inputMode="tel" value={num} onChange={(e) => setNum(e.target.value)}
          error={num && !normalizeNgPhone(num) ? 'Enter a valid Nigerian number.' : null} hint="Check the number before sending." />
        <TextArea label="Message (you can edit it)" rows={9} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-col gap-2 sm:flex-row">
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => { onOpened?.(); setTimeout(onClose, 300); }}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald px-5 font-semibold text-white hover:bg-emerald-600">
              <MessageCircle className="h-5 w-5" /> Open WhatsApp
            </a>
          ) : <Button disabled className="flex-1"><MessageCircle className="h-5 w-5" /> Open WhatsApp</Button>}
          <Button variant="secondary" className="flex-1" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* clipboard blocked */ } }}>
            {copied ? 'Copied ✓' : 'Copy message'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
