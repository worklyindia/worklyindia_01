import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReactiveResume, UserResume } from '@/hooks/useReactiveResume';
import { 
  FileText, 
  Download, 
  Edit, 
  Trash2, 
  Clock, 
  CloudOff,
  Cloud,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface SavedResumesProps {
  onEdit?: (resume: UserResume) => void;
}

const SavedResumes = ({ onEdit }: SavedResumesProps) => {
  const navigate = useNavigate();
  const { 
    userResumes, 
    isLoadingResumes, 
    deleteResume, 
    isDeleting,
    downloadPdf,
    isDownloading,
    isApiConfigured
  } = useReactiveResume();

  const handleEdit = (resume: UserResume) => {
    if (onEdit) {
      onEdit(resume);
    } else {
      navigate(`/resume-editor?id=${resume.id}&template=${resume.template}`);
    }
  };

  const handleDownload = (resume: UserResume) => {
    if (resume.reactive_resume_id && isApiConfigured) {
      downloadPdf({ 
        resumeId: resume.id, 
        filename: `${resume.name.replace(/\s+/g, '_')}.pdf` 
      });
    } else {
      // Fallback to local PDF generation
      navigate(`/resume-editor?id=${resume.id}&template=${resume.template}&download=true`);
    }
  };

  if (isLoadingResumes) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (userResumes.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Saved Resumes</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create your first resume to get started
        </p>
        <Button onClick={() => navigate('/resume-editor')}>
          Create Resume
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Your Resumes</h3>
      
      <div className="grid gap-4">
        {userResumes.map((resume) => (
          <Card key={resume.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{resume.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>
                      Updated {formatDistanceToNow(new Date(resume.updated_at), { addSuffix: true })}
                    </span>
                    {resume.reactive_resume_id ? (
                      <Badge variant="secondary" className="text-xs">
                        <Cloud className="w-3 h-3 mr-1" />
                        Synced
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <CloudOff className="w-3 h-3 mr-1" />
                        Local
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(resume)}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(resume)}
                >
                  <Edit className="w-4 h-4" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Resume</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{resume.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteResume(resume.id)}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SavedResumes;
