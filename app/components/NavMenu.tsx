'use client';

import { useState } from 'react';
import { IconButton, Avatar, Menu, MenuItem, Divider } from '@mui/material';

interface NavMenuProps {
  onNavigate: (page: string) => void;
}

export default function NavMenu({ onNavigate }: NavMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (page: string) => {
    handleClose();
    onNavigate(page);
  };

  return (
    <div className="absolute top-4 right-4">
      <IconButton
        onClick={handleClick}
        size="small"
        aria-controls={open ? 'account-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        className="bg-white/80 dark:bg-gray-800/50 hover:bg-white/90 dark:hover:bg-gray-700/50 transition-colors"
      >
        <Avatar sx={{ width: 32, height: 32 }} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.15))',
            mt: 1.5,
            bgcolor: 'background.paper',
            '& .MuiMenuItem-root': {
              px: 2,
              py: 1.5,
              fontSize: '0.875rem',
            },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => handleMenuItemClick('newsletter')}>
          Newsletter Preferences
        </MenuItem>
        <MenuItem onClick={() => handleMenuItemClick('settings')}>
          Settings
        </MenuItem>
        <MenuItem onClick={() => handleMenuItemClick('account')}>
          Account
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleMenuItemClick('logout')}>
          Sign out
        </MenuItem>
      </Menu>
    </div>
  );
} 