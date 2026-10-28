import TranslationBottomSheet from './TranslationBottomSheet';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface TranslateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  selectedMessageIds: string[];
}

export default function TranslateDialog(props: TranslateDialogProps) {
  const handleTranslate = (translations: any[]) => {
    console.log('Translations completed:', translations);
  };

  return (
    <TranslationBottomSheet
      {...props}
      onTranslate={handleTranslate}
    />
  );
}
