import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '@ghostfolio/client/core/auth.guard';

import { HomePageComponent } from './home-page.component';

const routes: Routes = [
  { path: '', component: HomePageComponent, canActivate: [AuthGuard] }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HomePageRoutingModule {}
