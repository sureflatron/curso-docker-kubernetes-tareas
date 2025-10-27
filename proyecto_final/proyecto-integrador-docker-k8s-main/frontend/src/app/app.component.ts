import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface User {
  id?: number;
  nombre: string;
  email: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Spring Boot API - Proyecto Integrador';
  users: User[] = [];
  loading = false;
  error: string | null = null;
  success: string | null = null;

  // Detección de versión basada en puerto
  version = 'v2.0';
  environment = 'Producción';

  newUser: User = {
    nombre: '',
    email: ''
  };


    // ... propiedades existentes ...
    systemInfo: any = null;

  // API URL - Usa ruta relativa, nginx BFF proxy maneja el routing al backend
  // Docker Compose: nginx proxy → Kong Gateway → Spring Boot
  // Kubernetes: nginx proxy → api-service (DNS interno) → Spring Boot
  //private apiUrl = '/api/users';
  private apiUrl = '/api/users';



  constructor(private http: HttpClient) {
    this.detectEnvironment();
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  detectEnvironment(): void {
    const port = window.location.port;

    if (port === '4200') {
      this.version = 'v1.2-dev';
      this.environment = 'Desarrollo Local';
    } else {
      this.version = 'v2.0';
      this.environment = 'Producción';
    }
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;

    this.http.get<User[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar usuarios: ' + err.message;
        this.loading = false;
      }
    });
  }

  createUser(): void {
    if (!this.newUser.nombre || !this.newUser.email) {
      this.error = 'Por favor completa todos los campos';
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    this.http.post<User>(this.apiUrl, this.newUser).subscribe({
      next: (user) => {
        this.success = 'Usuario creado correctamente';
        this.users.push(user);
        this.newUser = { nombre: '', email: '' };
        this.loading = false;

        // Clear success message after 3 seconds
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.error = 'Error al crear usuario: ' + (err.error?.error || err.message);
        this.loading = false;
      }
    });
  }

  deleteUser(id: number): void {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.success = 'Usuario eliminado correctamente';
        this.users = this.users.filter(u => u.id !== id);
        this.loading = false;

        // Clear success message after 3 seconds
        setTimeout(() => this.success = null, 3000);
      },
      error: (err) => {
        this.error = 'Error al eliminar usuario: ' + err.message;
        this.loading = false;
      }
    });
  }



  
        // ... métodos existentes ...

        getSystemInfo(): void {
          this.http.get('/api/info').subscribe({
            next: (data) => {
              this.systemInfo = data;
              this.success = 'Información del sistema cargada';
              setTimeout(() => this.success = null, 3000);
            },
            error: (err) => {
              this.error = 'Error al obtener información del sistema';
              console.error('Error:', err);
            }
          });
        }
      

  clearMessages(): void {
    this.error = null;
    this.success = null;
  }


}
