# ==============================================================================
# Camera Simulation Hub (EC2)
# ==============================================================================

# 1. IAM Role for EC2 (Instance Profile)
resource "aws_iam_role" "camera_hub_role" {
  name = "teraspot_camera_hub_role_${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# Attach SSM Policy for remote management (Session Manager & Run Command)
resource "aws_iam_role_policy_attachment" "camera_hub_ssm" {
  role       = aws_iam_role.camera_hub_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Attach ECR Read Policy to pull the Fog image
resource "aws_iam_role_policy_attachment" "camera_hub_ecr" {
  role       = aws_iam_role.camera_hub_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "camera_hub_profile" {
  name = "teraspot_camera_hub_profile_${var.environment}"
  role = aws_iam_role.camera_hub_role.name
}

# 2. Security Group
resource "aws_security_group" "camera_hub_sg" {
  name        = "teraspot-camera-hub-sg-${var.environment}"
  description = "Security group for Camera Simulation Hub"
  # No ingress needed if using SSM!
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 3. EC2 Instance
# Using Amazon Linux 2023 AMI (Free Tier eligible usually)
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_instance" "camera_hub" {
  count         = var.camera_sim_count > 0 ? 1 : 0
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t2.micro"

  iam_instance_profile = aws_iam_instance_profile.camera_hub_profile.name
  security_groups      = [aws_security_group.camera_hub_sg.name]

  tags = {
    Name        = "TeraSpot-Dev-Cluster"
    Environment = var.environment
  }

  user_data = <<-EOF
    #!/bin/bash
    dnf update -y
    dnf install -y docker
    systemctl start docker
    systemctl enable docker
    usermod -aG docker ec2-user

    # Authenticate with ECR
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.fog_repo.repository_url}

    # Pull the latest image
    docker pull ${aws_ecr_repository.fog_repo.repository_url}:latest

    # Create a directory for videos
    mkdir -p /opt/videos
    # Download a sample video (using a placeholder URL or S3 if available, for now we use a dummy file or the one in the image)
    # Ideally, we would download different videos here from S3.
    # For this demo, we will rely on the video INSIDE the container or a simple download.
    
    # Launch 3 Camera Containers
    PREFIXES=("A" "B" "C")
    for i in {1..3}
    do
        CAMERA_ID="camera-sim-$i"
        # Array index is 0-based, loop is 1-based
        PREFIX=$${PREFIXES[$((i-1))]}
        
        echo "Starting $CAMERA_ID with prefix $PREFIX..."
        
        if [ "$i" -eq 3 ]; then
            echo "Starting $CAMERA_ID with YOLO enabled..."
            docker run -d \
                --name $CAMERA_ID \
                --restart unless-stopped \
                -e AWS_IOT_ENDPOINT="${data.aws_iot_endpoint.current.endpoint_address}" \
                -e AWS_IOT_THING_NAME="$CAMERA_ID" \
                -e AWS_IOT_FACILITY_ID="facility-1" \
                -e AWS_IOT_ZONE_ID="zone-1" \
                -e AWS_IOT_CERT_PATH="/app/certs" \
                ${aws_ecr_repository.fog_repo.repository_url}:latest \
                python src/edge_publisher.py \
                --use-yolo \
                --video "assets/parking_lot.mp4" \
                --roi-s3-bucket "${var.bucket_name}" \
                --roi-s3-key "configs/roi-$CAMERA_ID.json" \
                --spaces 10 \
                --interval 10 \
                --prefix "$PREFIX"
        else
            echo "Starting $CAMERA_ID in MOCK mode..."
            docker run -d \
                --name $CAMERA_ID \
                --restart unless-stopped \
                -e AWS_IOT_ENDPOINT="${data.aws_iot_endpoint.current.endpoint_address}" \
                -e AWS_IOT_THING_NAME="$CAMERA_ID" \
                -e AWS_IOT_FACILITY_ID="facility-1" \
                -e AWS_IOT_ZONE_ID="zone-1" \
                -e AWS_IOT_CERT_PATH="/app/certs" \
                ${aws_ecr_repository.fog_repo.repository_url}:latest \
                python src/edge_publisher.py \
                --static-mock \
                --video "assets/parking_lot.mp4" \
                --spaces 10 \
                --interval 10 \
                --prefix "$PREFIX"
        fi
    done
  EOF
}

# Data source for IoT Endpoint
data "aws_iot_endpoint" "current" {
  endpoint_type = "iot:Data-ATS"
}
