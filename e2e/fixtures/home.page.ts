import { Component } from '@angular/core';

import { GET_TASKS, ADD_TASK } from '../../services/sync/graphql.queries';
import { VoyagerService } from '../../services/sync/voyager.service';
import { ItemService } from '../../services/sync/item.service';

declare global {
  interface Window { aerogear: any; }
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  constructor(
    public aerogear: VoyagerService,
    public itemService: ItemService
  ) {
    window.aerogear = {
      voyeager: aerogear,
      queries: {
        GET_TASKS,
        ADD_TASK
      },
      itemService
    };
  }

}
