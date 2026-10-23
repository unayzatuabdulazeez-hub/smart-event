'use client';
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/lib/whatsapp';
import { Button, Modal, TextArea } from './ui';

/** Click-to-chat only. The owner can edit the message first; nothing is sent automatically. */
export default function WhatsAppSheet({ open, onClose, phone, message, title = 'Message customer' }: {
  open: boolean; onClose: () => void; phone: string | null | undefined; message: string; title?: string;
}) {
  const [text, setText] = useState(message);
  useEffect(() => { if (open) setText(message); }, [open, message]);
  const link = whatsappLink(phone, text);
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {!link && <p role="alert" className="mb-3 rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-600">This customer has no valid WhatsApp number yet. Add one on their profile first.</p>}
      <TextArea label="Message (you can edit it)" rows={9} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="whatsapp" className="flex-1" disabled={!link || !text.trim()}
          onClick={() => { if (link) { window.open(link, '_blank', 'noopener,noreferrer'); onClose(); } }}>
          <MessageCircle className="h-4 w-4" aria-hidden /> Open WhatsApp
        </Button>
      </div>
    </Modal>
  );
}
