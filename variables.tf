variable "team_name" {
  description = "Name of the development team responsible for this service"
  type        = string
  default     = "justice-redact"
}

variable "environment" {
  description = "Name of the environment type for this service"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

variable "namespace" {
  description = "Name of the namespace these resources are part of"
  type        = string
  default     = "justice-redact-dev"
}

variable "ecr_repository_name" {
  description = "ECR repository name"
  type        = string
}