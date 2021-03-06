import FS from 'fs-extra';
import path from 'path';
import { IUserData } from '../common/props';
import { sleep, getUserInfoData } from './';


/**
 * 用于更新用户数据，最终数据
 */
let users: IUserData[] = [];

/**
 * 用于缓存老用户数据，做数据比对筛选
 */
let usersStore: IUserData[] = [];


export async function saveUserData(data: IUserData[], type: string = '') {
  await FS.outputFile(path.join(process.cwd(), 'dist', `users${type}.json`), JSON.stringify(data, null, 2));
}

async function saveCacheUserData(data: IUserData[], type: string = '') {
  await FS.outputFile(path.join(process.cwd(), '.cache', `users${type}.json`), JSON.stringify(data, null, 2));
}


async function getInfo(arr: IUserData[], type: string = '', globalUsers: IUserData[] = []) {
  const user = arr[0];
  if (!user) {
    return;
  }
  console.log(`\n-> 获取 ${user.login} 的更多信息！`);
  let isLocalData = true;
  let findUser: IUserData | undefined = globalUsers.find(item => item.login === user.login);
  if (!findUser) {
    isLocalData = false;
    findUser = await getUserInfoData(user.login);
    if (findUser.message && findUser.documentation_url) {
      console.log(`<- 还剩 ${arr.length} 个用户信息！error: ${findUser.message} -> ${findUser.documentation_url}`);
      return;
    } else if (!findUser.followers) {
      console.log(`<- 用户 ${user.login} 的数据获取失败，重新获取！`);
      await sleep(2000);
      await getInfo(arr, type, globalUsers);
      return;
    }
  }

  const userFilter = usersStore.find(item => (findUser && item.login === findUser.login) as boolean);
  if (!userFilter) {
    users.push(findUser);
  } else {
    users = users.map((item: IUserData) => {
      if (findUser && item.login === findUser.login) {
        item = { ...user, ...findUser };
      }
      return item;
    });
  }
  await saveUserData(users, type);
  // 获取成功删除第一条
  arr.shift();
  await saveCacheUserData(arr, type);
  console.log(`<- 用户 ${user.login} 的数据获取完成！还剩 ${arr.length} 个用户信息！`);
  if (!isLocalData) {
    await sleep(1000);
  }
  await getInfo(arr, type, globalUsers);
}

/**
 * 用户数据根据 `followers` 排序
 * @param {IUserData[]} users 用户数据
 */
function sortUser(users: IUserData[]) {
  users.sort((a: IUserData, b: IUserData) => {
    if (b.followers && a.followers) {
      return b.followers - a.followers;
    }
    return 0;
  });
  users = users.map((item: IUserData, idx: number) => {
    item.rank = idx + 1;
    return item;
  });
  return users;
}

/**
 * 更新用户信息
 * @param {IUserData[]} usersDist 原始用户数据。
 * @param {IUserData[]} cacheUsers 缓存用户数据，获取到的新用户数据，用于数据请求。
 * @param {IUserData[]} globalUsers 全球用户，已完成获取数据，过滤不再请求 API 了
 * @param {String} type 类型，取值 `空` | 或者 `.china` 用于存储。
 */
export async function saveUsersData(usersDist: IUserData[], cacheUsers: IUserData[], type: string, globalUsers?: IUserData[]) {
  users = [...usersDist];
  usersStore = [...usersDist];
  if (cacheUsers && cacheUsers.length > 0) {
    await getInfo(cacheUsers, type, globalUsers);
  }
  users = sortUser(users);
  users.splice(500, users.length);
  await saveUserData(users, type);
  return users;
}