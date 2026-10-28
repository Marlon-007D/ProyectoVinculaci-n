pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  tools {
    nodejs 'Node 22'
  }

  stages {
    stage('Install and build') {
      steps {
        checkout scm
        sh 'npm ci'
        sh 'npm run build'
      }
    }

    stage('SonarQube') {
      steps {
        withSonarQubeEnv('SonarQube') {
          sh 'sonar-scanner -Dsonar.organization="$SONAR_ORGANIZATION" -Dsonar.qualitygate.wait=true'
        }
      }
    }

    stage('Snyk Code') {
      steps {
        withCredentials([string(credentialsId: 'SNYK_TOKEN', variable: 'SNYK_TOKEN')]) {
          sh 'npx --yes snyk@latest code test'
        }
      }
    }
  }

  post {
    always {
      cleanWs()
    }
  }
}
