export const businessTypeLabels: Record<string, string> = {
  sole_proprietorship: "Sole Proprietorship",
  partnership: "Partnership", 
  llp: "Limited Liability Partnership (LLP)",
  private_limited: "Private Limited Company",
  public_limited: "Public Limited Company"
};

export const getBusinessTypeLabel = (businessType: string | null | undefined): string => {
  if (!businessType) return "";
  return businessTypeLabels[businessType] || businessType;
};