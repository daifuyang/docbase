import { Link, useRouter } from '@tanstack/react-router'
import { ChevronDown, KeyRound, LogOut, Menu, ShieldCheck } from 'lucide-react'
import { useTransition } from 'react'
import { SearchDialog } from '~/components/search-dialog'
import { SidebarContent } from '~/components/sidebar'
import { ThemeMenuItem } from '~/components/theme-toggle'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '~/components/ui/sheet'
import { signOut } from '~/server/auth'

type Me = {
  id: string
  username: string
  displayName: string | null
  role?: 'admin' | 'member'
} | null
type SidebarTag = { name: string; slug: string }
type SidebarSpace = Parameters<typeof SidebarContent>[0]['spaces']
type SidebarExpandedKeys = Parameters<typeof SidebarContent>[0]['expandedKeys']

type NavProps = {
  me: Exclude<Me, null>
  tags?: SidebarTag[]
  spaces?: SidebarSpace
  expandedKeys?: SidebarExpandedKeys
}

export function Nav({ me, tags = [], spaces = [], expandedKeys = [] }: NavProps) {
  const router = useRouter()

  const [pending, startTransition] = useTransition()

  const onSignOut = () => {
    startTransition(async () => {
      await signOut()
      router.invalidate()
    })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-[1920px] items-center gap-3 px-4 sm:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-4 w-4" />
              <span className="sr-only">打开菜单</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-4">
            <SheetHeader className="mb-5">
              <SheetTitle className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  D
                </span>
                DocBase
              </SheetTitle>
            </SheetHeader>
            <SidebarContent popularTags={tags} spaces={spaces} expandedKeys={expandedKeys} />
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <span className="text-sm">D</span>
          </span>
          <span className="text-[15px]">DocBase</span>
        </Link>

        <div className="flex-1" />

        <nav className="ml-auto flex items-center gap-2">
          <SearchDialog popularTags={tags} />
          {me?.role === 'admin' && (
            <Button asChild variant="ghost" className="hidden h-9 gap-1.5 px-2.5 sm:inline-flex">
              <Link to="/admin">
                <ShieldCheck className="h-4 w-4" />
                管理
              </Link>
            </Button>
          )}
          {me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="h-9 gap-2 px-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs font-semibold">
                      {(me.displayName ?? me.username).slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-28 truncate sm:inline">
                    {me.displayName ?? me.username}
                  </span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate text-sm">{me.displayName ?? me.username}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    @{me.username}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings/tokens">
                    <KeyRound className="h-4 w-4" />
                    访问令牌
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {me.role === 'admin' && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <ShieldCheck className="h-4 w-4" />
                        知识库管理
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <ThemeMenuItem />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut} disabled={pending}>
                  <LogOut className="h-4 w-4" />
                  {pending ? '退出中' : '退出登录'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link to="/auth/login">登录</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
