import { Component, OnInit } from '@angular/core';
import { DataSource } from '@angular/cdk/collections';
import { HttpParams, HttpClient, HttpHeaders, HttpResponse, HttpRequest } from '@angular/common/http';
import { MdDialog } from '@angular/material';
import { Observable } from 'rxjs/Observable';
import { environment } from '../../environments/environment';
import { AwardPlan, QuizTypeEnum, QuizTypeEnum2UIString, LogLevel, DateFormat } from '../model';
import { AwardPlanService, QuizAttendUser, UserDetailService, DialogService, AuthService } from '../services';
import { MessageDialogButtonEnum, MessageDialogInfo, MessageDialogComponent } from '../message-dialog';

/**
 * Award plan data source
 */
export class AwardPlanDataSource extends DataSource<any> {
  constructor() {
    super();
  }

  private _apService: AwardPlanService = null;
  set AwardPlanService(ap: AwardPlanService) {
    this._apService = ap;
  }

  private _curuser: string;
  get CurrentUser(): string {
    return this._curuser;
  }
  set CurrentUser(cu: string) {
    this._curuser = cu;
  }

  /** Connect function called by the table to retrieve one stream containing the data to render. */
  connect(): Observable<AwardPlan[]> {
    return this._apService.dataChangedSubject.switchMap((v: boolean) => {
      if (this._curuser !== null && this._curuser !== undefined && this._curuser.length > 0) {
        return this._apService.fetchPlansForUser(this._curuser);
      } else {
        return Observable.of([]);
      }
    });
  }

  disconnect() { }
}

export interface QuizTypeUI {
  value: QuizTypeEnum;
  displayas: string;
}

@Component({
  selector: 'app-award-plan',
  templateUrl: './award-plan.component.html',
  styleUrls: ['./award-plan.component.scss']
})
export class AwardPlanComponent implements OnInit {
  displayedColumns = ['ID', 'ValidFrom', 'ValidTo', 'QuizType', 'AwardCondition', 'Award'];
  pageHeader: string;
  dataSource: AwardPlanDataSource = null;
  listUsers: QuizAttendUser[] = [];

  private _isListView: boolean;
  get IsListView(): boolean {
    return this._isListView;
  }
  set IsListView(lv: boolean) {
    this._isListView = lv;
  }
  private _isDetailView: boolean;
  get IsDetailView(): boolean {
    return this._isDetailView;
  }
  set IsDetailView(dv: boolean) {
    this._isDetailView = dv;
  }
  private _curUser: QuizAttendUser;
  get CurrentUser(): QuizAttendUser {
    return this._curUser;
  }
  set CurrentUser(cu: QuizAttendUser) {
    if ((this._curUser === null || this._curUser === undefined)
      && (cu !== null && cu !== undefined)) {
      this._curUser = cu;
      this.dataSource.CurrentUser = this._curUser.attenduser;
    } else if ((this._curUser !== null || this._curUser !== undefined)
      && (cu === null && cu === undefined)) {
      this._curUser = null;
      this.dataSource.CurrentUser = null;
    } else if ((this._curUser !== null || this._curUser !== undefined)
      && (cu !== null && cu !== undefined)
      && this._curUser.attenduser !== cu.attenduser) {
      this._curUser = cu;
      this.dataSource.CurrentUser = this._curUser.attenduser;
    }
  }

  listQTypes: QuizTypeUI[] = [];

  private _curPlan: AwardPlan;
  get CurrentPlan(): AwardPlan {
    return this._curPlan;
  }

  constructor(private _http: HttpClient,
    private _dialog: MdDialog,
    private _apService: AwardPlanService,
    private _authService: AuthService,
    private _userDetailService: UserDetailService) {
    this.dataSource = new AwardPlanDataSource();
    this.dataSource.AwardPlanService = this._apService;

    for (const qt in QuizTypeEnum) {
      if (!Number.isNaN(+qt)) {
        const qtu: QuizTypeUI = {
          value: +qt,
          displayas: QuizTypeEnum2UIString(+qt)
        };
        this.listQTypes.push(qtu);
      }
    }

    // Attended user
    this._userDetailService.fetchAllUsers().subscribe((listUsrs) => {
      if (listUsrs !== null && listUsrs !== undefined || listUsrs.length > 0) {
        this.listUsers = listUsrs;
      }
    });

    this.setListView();
  }

  ngOnInit() {
  }

  public onCreatePlan() {
    this._curPlan = new AwardPlan();
    this._curPlan.TargetUser = this.CurrentUser.attenduser;
    this._curPlan.CreatedBy = this._authService.authSubject.getValue().getUserId();

    this.setDetailView('Home.CreateAwardPlan');
    this.IsListView = false;
    this.IsDetailView = true;
  }

  public onEditPlan(row) {
    // Todo
    try {
      this._curPlan = row;
      this.setDetailView('Home.EditAwardPlan');
    } catch (exp) {
      console.error(exp);
    }
  }

  public onDeletePlan(row) {
    const dlginfo: MessageDialogInfo = {
      Header: 'Home.ConfirmOnDeletion',
      Content: 'Home.ConfirmOnDeletionDetail',
      Button: MessageDialogButtonEnum.okcancel
    };

    this._dialog.open(MessageDialogComponent, {
      disableClose: false,
      width: '500px',
      data: dlginfo
    }).afterClosed().subscribe(x => {
      // Do nothing!
      if (environment.LoggingLevel >= LogLevel.Debug) {
        console.log(`AC Math Exericse [Debug]: Message Dialog Result ${x}`);
      }

      if (x) {
        this._apService.deleteAwardPlan(row);
      }
    });
  }

  public onUserChanged(event) {
    // User selection changed
    // Refetch the whole plan list!
    this._apService.triggerDataChange();
  }

  public canDeactivate(): boolean {
    if (this.IsDetailView) {
      const dlginfo: MessageDialogInfo = {
        Header: 'Home.Error',
        Content: 'Home.QuizIsOngoing',
        Button: MessageDialogButtonEnum.onlyok
      };
      this._dialog.open(MessageDialogComponent, {
        disableClose: false,
        width: '500px',
        data: dlginfo
      }).afterClosed().subscribe(x => {
        // Do nothing!
        if (environment.LoggingLevel >= LogLevel.Debug) {
          console.log(`AC Math Exericse [Debug]: Message Dialog Result ${x}`);
        }
      });
      return false;
    }

    return true;
  }

  public CanDetailPlanSubmit(): boolean {
    if (!this._isDetailView) {
      return false;
    }

    if (this.CurrentPlan === null || this.CurrentPlan === undefined) {
      return false;
    }

    if (this.CurrentPlan.ValidTo < this.CurrentPlan.ValidFrom) {
      return false;
    }

    if (this.CurrentPlan.QuizType === null || this.CurrentPlan.QuizType === undefined) {
      return false;
    }

    if (this.CurrentPlan.Award === null || this.CurrentPlan.Award === undefined || this.CurrentPlan.Award <= 0) {
      return false;
    }

    return true;
  }

  public onDetailPlanSubmit(): void {
    if ((this.CurrentPlan.ID)) {
      // Update mode
      this.onChangePlanImpl();
    } else {
      // Create mode
      this.onCreatePlanImpl();
    }
  }

  private onCreatePlanImpl(): void {
    // Submit to the API
    const apiurl = environment.APIBaseUrl + 'AwardPlan';

    const jdata = this.CurrentPlan.prepareData();
    const data = JSON && JSON.stringify(jdata);

    let headers = new HttpHeaders();
    headers = headers.append('Content-Type', 'application/json')
              .append('Accept', 'application/json')
              .append('Authorization', 'Bearer ' + this._authService.authSubject.getValue().getAccessToken());

    this._http.post(apiurl, data, {
        headers: headers,
        withCredentials: true
      })
      .map((response: HttpResponse<any>) => {
        if (environment.LoggingLevel >= LogLevel.Debug) {
          console.log('AC Math Exercise [Debug]:' + response);
        }
        return <any>response;
      })
      .subscribe(x => {
        if (environment.LoggingLevel >= LogLevel.Debug) {
          console.log('AC Math Exericse [Debug]: ' + x);
        }

        // Show a dialog for success
        const dlginfo: MessageDialogInfo = {
          Header: 'Home.Success',
          Content: 'Home.AwardPlanCreatedSuccessfully',
          Button: MessageDialogButtonEnum.onlyok
        };
        this._dialog.open(MessageDialogComponent, {
          disableClose: false,
          width: '500px',
          data: dlginfo
        }).afterClosed().subscribe(x => {
          // Do nothing!
          this.setListView();
        });
      }, error => {
        if (environment.LoggingLevel >= LogLevel.Error) {
          console.log('AC Math Exericse [Debug]: ' + error);
        }
        // Also show a dialog for error
        const dlginfo: MessageDialogInfo = {
          Header: 'Home.Error',
          Content: error,
          Button: MessageDialogButtonEnum.onlyok
        };
        this._dialog.open(MessageDialogComponent, {
          disableClose: false,
          width: '500px',
          data: dlginfo
        }).afterClosed().subscribe(x => {
          // Do nothing!
          //this.setListView();
        });
      }, () => {
      });
  }

  private onChangePlanImpl(): void {
    // Submit to the API
    const apiurl = environment.APIBaseUrl + 'AwardPlan/' + this.CurrentPlan.ID;

    const jdata = this.CurrentPlan.prepareData();
    const data = JSON && JSON.stringify(jdata);

    let headers = new HttpHeaders();
    headers = headers.append('Content-Type', 'application/json')
              .append('Accept', 'application/json')
              .append('Authorization', 'Bearer ' + this._authService.authSubject.getValue().getAccessToken());
    this._http.put(apiurl, data, {
        headers: headers,
        withCredentials: true
      })
      .map((response: HttpResponse<any>) => {
        if (environment.LoggingLevel >= LogLevel.Debug) {
          console.log('AC Math Exercise [Debug]:' + response);
        }
        return <any>response;
      })
      .subscribe(x => {
        if (environment.LoggingLevel >= LogLevel.Debug) {
          console.log('AC Math Exericse [Debug]: ' + x);
        }

        // Show a dialog for success
        const dlginfo: MessageDialogInfo = {
          Header: 'Home.Success',
          Content: 'Home.AwardPlanCreatedSuccessfully',
          Button: MessageDialogButtonEnum.onlyok
        };
        this._dialog.open(MessageDialogComponent, {
          disableClose: false,
          width: '500px',
          data: dlginfo
        }).afterClosed().subscribe(x => {
          // Do nothing!
          this.setListView();
        });
      }, error => {
        if (environment.LoggingLevel >= LogLevel.Error) {
          console.log('AC Math Exericse [Debug]: ' + error);
        }
        // Also show a dialog for error
        const dlginfo: MessageDialogInfo = {
          Header: 'Home.Error',
          Content: error,
          Button: MessageDialogButtonEnum.onlyok
        };
        this._dialog.open(MessageDialogComponent, {
          disableClose: false,
          width: '500px',
          data: dlginfo
        }).afterClosed().subscribe(x => {
          // Do nothing!
          //this.setListView();
        });
      }, () => {
      });
  }

  public onDetailPlanCancel(): void {
    this._curPlan = null;

    this.setListView();
  }

  private setListView() {
    this.pageHeader = 'Home.AwardPlan';
    this._isDetailView = false;
    this._isListView = true;
  }

  private setDetailView(header: string) {
    this._isListView = false;
    this.pageHeader = header;
    this._isDetailView = true;
  }
}
